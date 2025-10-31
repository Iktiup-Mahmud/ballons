import express from 'express';
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import Submission from './models/Submission.js';
import { scrapeStandings } from './utils/scraper.js';

// ES module equivalents for __dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables
dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// Contest URL will be stored in memory (can be changed by user)
let CONTEST_URL = process.env.CONTEST_URL || 'https://www.coderoj.com/c/4dBXruM';
let CURRENT_CONTEST_ID = extractContestId(CONTEST_URL);
let scrapeInterval = null;

/**
 * Extract contest ID from URL
 * Example: https://www.coderoj.com/c/MCQBt7n/ -> MCQBt7n
 */
function extractContestId(url) {
  const match = url.match(/\/c\/([^\/]+)/);
  return match ? match[1] : 'default';
}

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

// View engine setup
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// MongoDB Connection with improved error handling
const MONGO_URI = process.env.MONGO_URI || process.env.MONGODB_URI;

if (!MONGO_URI) {
  console.error('❌ MONGO_URI is not defined in .env file!');
  console.log('⚠️  Please create a .env file and add your MongoDB URI');
  process.exit(1);
}

// MongoDB connection - handle serverless (Vercel) differently
let isConnected = false;

async function connectDB() {
  if (isConnected) {
    return;
  }
  
  try {
    await mongoose.connect(MONGO_URI, {
      serverSelectionTimeoutMS: 5000,
      socketTimeoutMS: 45000,
    });
    isConnected = true;
    console.log('✅ Connected to MongoDB Atlas');
    console.log('📊 Database:', mongoose.connection.name);
  } catch (err) {
    console.error('❌ MongoDB connection error:', err.message);
    console.log('\n⚠️  Troubleshooting:');
    console.log('   1. Check your MONGO_URI in .env file');
    console.log('   2. Verify MongoDB Atlas network access (allow 0.0.0.0/0)');
    console.log('   3. Check username/password are correct');
    console.log('   4. Ensure cluster is active\n');
    throw err;
  }
}

// Connect to MongoDB immediately in non-Vercel environments
if (process.env.VERCEL !== '1') {
  connectDB().then(() => {
    // Start scraping after successful connection
    startScraping();
  });
}

/**
 * Scrape contest standings and update database
 */
async function scrapeAndUpdate() {
  try {
    console.log('\n🔄 Starting scrape and update...');
    
    const acceptedSubmissions = await scrapeStandings(CONTEST_URL);
    
    if (acceptedSubmissions.length === 0) {
      console.log('⚠️  No submissions found. The scraper might need adjustment.');
      return;
    }
    
    let newCount = 0;
    let existingCount = 0;
    
    // Insert new submissions (skip duplicates)
    for (const submission of acceptedSubmissions) {
      try {
        const existing = await Submission.findOne({
          contestId: CURRENT_CONTEST_ID,
          teamName: submission.teamName,
          problemCode: submission.problemCode
        });
        
        if (!existing) {
          await Submission.create({
            ...submission,
            contestId: CURRENT_CONTEST_ID,
            balloonStatus: 'waiting'
          });
          newCount++;
          console.log(`  ➕ New: ${submission.teamName} - Problem ${submission.problemCode}`);
        } else {
          existingCount++;
        }
      } catch (err) {
        // Handle duplicate key errors silently
        if (err.code !== 11000) {
          console.error(`  ⚠️  Error inserting submission: ${err.message}`);
        }
      }
    }
    
    console.log(`✅ Update complete: ${newCount} new, ${existingCount} existing`);
    
  } catch (error) {
    console.error('❌ Error in scrapeAndUpdate:', error.message);
  }
}

/**
 * Start auto-scraping with interval
 */
function startScraping() {
  // Clear existing interval if any
  if (scrapeInterval) {
    clearInterval(scrapeInterval);
  }
  
  // Initial scrape
  scrapeAndUpdate();
  
  // Auto-refresh: scrape every 30 seconds
  scrapeInterval = setInterval(() => {
    scrapeAndUpdate();
  }, 30000); // 30 seconds
}

/**
 * Main route - Display all submissions with balloon status
 */
app.get('/', async (req, res) => {
  try {
    await connectDB();
    
    // Get all submissions for the current contest, sort by newest first, then by waiting status
    const submissions = await Submission.find({ contestId: CURRENT_CONTEST_ID })
      .sort({ balloonStatus: 1, submissionTime: -1 }); // waiting first, then by time
    
    // Count statistics
    const waitingCount = submissions.filter(s => s.balloonStatus === 'waiting').length;
    const deliveredCount = submissions.filter(s => s.balloonStatus === 'delivered').length;
    
    res.render('index', {
      submissions,
      waitingCount,
      deliveredCount,
      totalCount: submissions.length,
      contestUrl: CONTEST_URL
    });
  } catch (error) {
    console.error('❌ Error fetching submissions:', error);
    res.status(500).send('Error loading submissions');
  }
});

/**
 * Mark balloon as delivered
 */
app.post('/deliver/:id', async (req, res) => {
  try {
    await connectDB();
    
    const submission = await Submission.findOne({ 
      _id: req.params.id, 
      contestId: CURRENT_CONTEST_ID 
    });
    
    if (!submission) {
      return res.status(404).send('Submission not found');
    }
    
    submission.balloonStatus = 'delivered';
    await submission.save();
    
    console.log(`🎈 Delivered: ${submission.teamName} - Problem ${submission.problemCode}`);
    
    res.redirect('/');
  } catch (error) {
    console.error('❌ Error marking as delivered:', error);
    res.status(500).send('Error updating submission');
  }
});

/**
 * Mark balloon as waiting (undo delivery)
 */
app.post('/undeliver/:id', async (req, res) => {
  try {
    await connectDB();
    
    const submission = await Submission.findOne({ 
      _id: req.params.id, 
      contestId: CURRENT_CONTEST_ID 
    });
    
    if (!submission) {
      return res.status(404).send('Submission not found');
    }
    
    submission.balloonStatus = 'waiting';
    await submission.save();
    
    console.log(`↩️  Undelivered: ${submission.teamName} - Problem ${submission.problemCode}`);
    
    res.redirect('/');
  } catch (error) {
    console.error('❌ Error marking as waiting:', error);
    res.status(500).send('Error updating submission');
  }
});

/**
 * Manual refresh endpoint
 */
app.post('/refresh', async (req, res) => {
  await connectDB();
  await scrapeAndUpdate();
  res.redirect('/');
});

/**
 * API endpoint to get submissions as JSON
 */
app.get('/api/submissions', async (req, res) => {
  try {
    await connectDB();
    
    const submissions = await Submission.find({ contestId: CURRENT_CONTEST_ID })
      .sort({ balloonStatus: 1, submissionTime: -1 });
    res.json(submissions);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * Change contest URL
 */
app.post('/change-contest', async (req, res) => {
  try {
    await connectDB();
    
    const newUrl = req.body.contestUrl;
    
    if (!newUrl || !newUrl.includes('coderoj.com/c/')) {
      return res.status(400).send('Invalid contest URL. Must be a CoderOJ contest URL.');
    }
    
    // Update the contest URL and extract new contest ID
    CONTEST_URL = newUrl;
    CURRENT_CONTEST_ID = extractContestId(CONTEST_URL);
    
    // Clear submissions only for the current contest
    await Submission.deleteMany({ contestId: CURRENT_CONTEST_ID });
    
    console.log(`\n🔄 Contest URL changed to: ${CONTEST_URL}`);
    console.log(`� Contest ID: ${CURRENT_CONTEST_ID}`);
    console.log(`🗑️  Submissions cleared for this contest`);
    
    // Restart scraping with new URL
    startScraping();
    
    res.redirect('/');
  } catch (error) {
    console.error('❌ Error changing contest:', error);
    res.status(500).send('Error changing contest');
  }
});

/**
 * Delete all submissions for current contest (for testing/reset)
 */
app.post('/reset', async (req, res) => {
  try {
    await connectDB();
    
    await Submission.deleteMany({ contestId: CURRENT_CONTEST_ID });
    console.log(`🗑️  All submissions cleared for contest: ${CURRENT_CONTEST_ID}`);
    res.redirect('/');
  } catch (error) {
    console.error('❌ Error resetting:', error);
    res.status(500).send('Error resetting database');
  }
});

// Start server (only in non-Vercel environments)
if (process.env.VERCEL !== '1') {
  app.listen(PORT, () => {
    console.log(`\n🎈 Balloon Tracker Server Running`);
    console.log(`📍 URL: http://localhost:${PORT}`);
    console.log(`🏆 Contest: ${CONTEST_URL}`);
    console.log(`⏱️  Auto-refresh: Every 30 seconds\n`);
  });
}

// Export for Vercel
export default app;

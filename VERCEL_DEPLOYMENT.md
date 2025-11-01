# 🎈 IUPC Balloon Tracker - Vercel Deployment Guide

## Environment Variables for Vercel

You need to set these environment variables in your Vercel project settings:

1. Go to your Vercel project dashboard
2. Navigate to **Settings** → **Environment Variables**
3. Add the following variables:

### Required Variables:

```
MONGO_URI=your_mongodb_connection_string
CONTEST_URL=https://www.coderoj.com/c/your-contest-id
```

### Optional Variables:

```
PORT=3000
```

## Important Notes for Vercel Deployment

### 1. **Auto-Scraping Limitation**

- ⚠️ Vercel uses serverless functions which don't support long-running intervals
- The 30-second auto-refresh won't work on Vercel
- You must manually click the **Refresh** button to update submissions
- Alternative: Use Vercel Cron Jobs (Pro plan) or external cron services

### 2. **MongoDB Atlas Configuration**

- ✅ Make sure your MongoDB Atlas allows connections from anywhere (0.0.0.0/0)
- Go to MongoDB Atlas → Network Access → Add IP Address → Allow Access from Anywhere

### 3. **Environment Variables**

- ⚠️ **DO NOT upload .env file to GitHub** (it's in .gitignore)
- Set environment variables directly in Vercel dashboard
- MONGO_URI and CONTEST_URL are required

### 4. **Static Files**

- CSS and JS files in `/public` folder will work automatically
- EJS templates in `/views` folder will render correctly

## Deployment Steps

### First Time Deployment:

1. **Push to GitHub:**

   ```bash
   git add .
   git commit -m "Add Vercel configuration"
   git push origin main
   ```

2. **Import in Vercel:**

   - Go to [vercel.com](https://vercel.com)
   - Click "Add New Project"
   - Import your GitHub repository
   - Vercel will auto-detect the configuration

3. **Set Environment Variables:**

   - In Vercel project settings, add:
     - `MONGO_URI`: Your MongoDB connection string
     - `CONTEST_URL`: Your contest URL

4. **Deploy:**
   - Click "Deploy"
   - Wait for deployment to complete

### Future Updates:

Just push to GitHub, Vercel will automatically redeploy:

```bash
git add .
git commit -m "Your changes"
git push origin main
```

## Testing Locally

To test if Vercel deployment will work:

```bash
npm install -g vercel
vercel dev
```

## Troubleshooting

### Issue: "Application Error" on Vercel

**Solution:** Check Vercel deployment logs for the specific error

### Issue: Database Connection Failed

**Solution:**

- Verify MONGO_URI is set in Vercel environment variables
- Check MongoDB Atlas network access settings

### Issue: Auto-refresh not working

**Solution:** This is expected on Vercel. Use the manual Refresh button or set up Vercel Cron Jobs

### Issue: 404 on CSS/JS files

**Solution:** Make sure `public` folder is committed to GitHub

## Auto-Scraping Solution for Vercel

Since Vercel serverless functions can't run continuous intervals, you have these options:

### Option 1: Manual Refresh (Current)

- Click the "Refresh Data" button when needed
- Simple and free

### Option 2: Vercel Cron Jobs (Pro Plan)

Create `vercel.json` with cron configuration:

```json
{
  "crons": [
    {
      "path": "/api/cron-scrape",
      "schedule": "*/1 * * * *"
    }
  ]
}
```

### Option 3: External Cron Service (Free)

Use services like:

- cron-job.org
- EasyCron
- UptimeRobot

Set them to ping: `https://your-app.vercel.app/refresh` every minute

## Support

If you encounter issues:

1. Check Vercel deployment logs
2. Verify environment variables are set correctly
3. Test MongoDB connection from a different tool
4. Ensure GitHub repository is up to date

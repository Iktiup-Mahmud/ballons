import axios from 'axios';
import * as cheerio from 'cheerio';

/**
 * Scrapes the CoderOJ contest standings page
 * @param {string} contestUrl - The contest URL to scrape
 * @returns {Promise<Array>} Array of accepted submissions
 */
export async function scrapeStandings(contestUrl) {
  try {
    console.log(`🔍 Scraping contest: ${contestUrl}`);
    
    // Ensure we're hitting the standings page
    if (!contestUrl.includes('/standings')) {
      contestUrl = contestUrl.replace(/\/$/, '') + '/standings';
    }
    
    // Fetch the HTML content
    const response = await axios.get(contestUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
      },
      timeout: 10000
    });

    const html = response.data;
    const $ = cheerio.load(html);
    
    const submissions = [];
    
    // CoderOJ specific structure
    const table = $('table').first();
    
    if (!table.length) {
      console.log('⚠️  No table found on the page');
      return submissions;
    }

    // Get problem codes from header row (CoderOJ specific)
    const problemCodes = [];
    table.find('thead tr th').each((index, element) => {
      const text = $(element).text().trim();
      // Extract problem code (just the letter A, B, C, etc.)
      const match = text.match(/^([A-Z])\s/);
      if (match) {
        problemCodes.push(match[1]);
      }
    });

    console.log(`📊 Found problem codes: ${problemCodes.join(', ')}`);

    if (problemCodes.length === 0) {
      console.log('⚠️  No problem codes found in table headers');
      return submissions;
    }

    // Parse each team row
    table.find('tbody tr').each((rowIndex, row) => {
      const $row = $(row);
      const cells = $row.find('td');
      
      if (cells.length === 0) return;
      
      // Team name is in the second cell (index 1) inside .teamName div
      const teamNameElem = $row.find('.teamName').first();
      const teamName = teamNameElem.text().trim();
      
      if (!teamName) return;
      
      // Start from cell index 4 (where problems start in CoderOJ)
      // Cells: [0]=rank, [1]=team, [2]=score, [3]=spacer, [4+]=problems
      let problemIndex = 0;
      for (let cellIndex = 4; cellIndex < cells.length; cellIndex++) {
        const $cell = $(cells[cellIndex]);
        
        // Check if this cell has a solved submission
        // CoderOJ shows: <div class="label label-default">1 (time)</div>
        const labelDefault = $cell.find('.label-default').text().trim();
        
        if (labelDefault && labelDefault.match(/\d+\s*\(\d+\)/)) {
          // This is an accepted submission
          // Extract time from format: "1 (123)" or "1 (2912)"
          const timeMatch = labelDefault.match(/\((\d+)\)/);
          const time = timeMatch ? timeMatch[1] : 'N/A';
          
          if (problemIndex < problemCodes.length) {
            submissions.push({
              teamName,
              problemCode: problemCodes[problemIndex],
              time
            });
          }
        }
        
        problemIndex++;
      }
    });

    console.log(`✅ Scraped ${submissions.length} accepted submissions`);
    return submissions;
    
  } catch (error) {
    console.error('❌ Error scraping contest:', error.message);
    return [];
  }
}

export default { scrapeStandings };

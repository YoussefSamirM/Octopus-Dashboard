const fs = require('fs');
const path = require('path');

function processDir(dir) {
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const fullPath = path.join(dir, file);
    if (fs.statSync(fullPath).isDirectory()) {
      processDir(fullPath);
    } else if (fullPath.endsWith('.tsx') || fullPath.endsWith('.ts')) {
      let content = fs.readFileSync(fullPath, 'utf-8');
      let orig = content;
      
      // 1. Remove shadows (except shadow-sm if we want, but let's just downgrade all to border or remove)
      content = content.replace(/shadow-\[.*?\]/g, ''); // Custom shadows
      content = content.replace(/shadow-(md|lg|xl|2xl|inner|none)/g, ''); 
      content = content.replace(/drop-shadow(-\[.*?\]|-sm|-md|-lg|-xl)?/g, ''); 
      
      // 2. Remove gradients
      content = content.replace(/bg-gradient-to-[a-z]+/g, '');
      content = content.replace(/from-(brand|indigo|purple|blue|surface|white|black)(-\d+(?:\/\d+)?)?/g, '');
      content = content.replace(/via-(brand|indigo|purple|blue|surface|white|black)(-\d+(?:\/\d+)?)?/g, '');
      content = content.replace(/to-(brand|indigo|purple|blue|surface|white|black)(-\d+(?:\/\d+)?)?/g, '');
      content = content.replace(/via-\[.*?\]/g, '');
      
      // 3. Fix rounded radii to rounded-md
      content = content.replace(/rounded-(lg|xl|2xl|3xl|\[\d+px\])/g, 'rounded-md');

      // 4. Remove uppercase and tracking-wider
      content = content.replace(/\buppercase\b/g, '');
      content = content.replace(/\btracking-wider\b/g, '');
      content = content.replace(/\bcapitalize\b/g, '');

      // 5. Replace em dash with a normal hyphen for empty data, or empty string
      // Watch out for JSX text vs code.
      content = content.replace(/—/g, '-');

      // 6. Emojis
      content = content.replace(/[✨✦✧🪄🚀⚡🎯🔥]/g, '');
      
      // 8. Sliding arrows
      content = content.replace(/group-hover:translate-x-\d+/g, '');

      // 9. Extra spaces left over
      content = content.replace(/ className="([^"]*)"/g, (match, p1) => {
          let cleaned = p1.replace(/\s+/g, ' ').trim();
          if (cleaned === '') return '';
          return ` className="${cleaned}"`;
      });
      content = content.replace(/ className={`([^`]*)`}/g, (match, p1) => {
          let cleaned = p1.replace(/\s+/g, ' ').trim();
          if (cleaned === '') return '';
          return ` className={\`${cleaned}\`}`;
      });

      if (orig !== content) {
        fs.writeFileSync(fullPath, content, 'utf-8');
        console.log(`Updated: ${fullPath}`);
      }
    }
  }
}

processDir(path.join(__dirname, 'src', 'pages'));
processDir(path.join(__dirname, 'src', 'components'));
console.log('Done!');

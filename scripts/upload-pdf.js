const fs = require('fs');
const pdf = require('pdf-parse');
const { addKnowledge } = require('./add-knowledge');

async function processPDF(filePath, category = 'FAQ') {
  try {
    const dataBuffer = fs.readFileSync(filePath);
    const data = await pdf(dataBuffer);
    
    // Split text into chunks (roughly by double newline)
    const chunks = data.text.split('\n\n').filter(c => c.trim().length > 50);
    
    console.log(`📄 Processing PDF: ${filePath} (${chunks.length} chunks)`);
    
    for (const chunk of chunks) {
      await addKnowledge(chunk.trim(), category);
    }
    
    console.log('✅ PDF Processing complete!');
  } catch (err) {
    console.error('❌ PDF Error:', err.message);
  }
}

if (require.main === module) {
  const args = process.argv.slice(2);
  if (args.length < 1) {
    console.log('Usage: node upload-pdf.js <path-to-pdf> [CATEGORY]');
  } else {
    processPDF(args[0], args[1] || 'FAQ').then(() => process.exit(0));
  }
}

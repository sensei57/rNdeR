const fs = require('fs');

// Créer un PNG minimal valide 192x192 (carré bleu)
const createPNG = (size) => {
  // En-tête PNG
  const header = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  
  // Chunk IHDR
  const ihdr = Buffer.alloc(25);
  ihdr.writeUInt32BE(13, 0); // Longueur
  ihdr.write('IHDR', 4);
  ihdr.writeUInt32BE(size, 8); // Largeur
  ihdr.writeUInt32BE(size, 12); // Hauteur
  ihdr.writeUInt8(8, 16); // Profondeur
  ihdr.writeUInt8(2, 17); // Type couleur (RGB)
  ihdr.writeUInt8(0, 18); // Compression
  ihdr.writeUInt8(0, 19); // Filtre
  ihdr.writeUInt8(0, 20); // Entrelacement
  
  // CRC pour IHDR
  const crc = require('zlib').crc32(ihdr.slice(4, 21));
  ihdr.writeUInt32BE(crc, 21);
  
  // Créer les données d'image (bleu #3B82F6)
  const rowSize = size * 3 + 1; // 3 bytes per pixel + 1 filter byte
  const imageData = Buffer.alloc(rowSize * size);
  
  for (let y = 0; y < size; y++) {
    imageData[y * rowSize] = 0; // Filtre none
    for (let x = 0; x < size; x++) {
      const offset = y * rowSize + 1 + x * 3;
      imageData[offset] = 0x3B; // R
      imageData[offset + 1] = 0x82; // G
      imageData[offset + 2] = 0xF6; // B
    }
  }
  
  // Compresser les données
  const compressed = require('zlib').deflateSync(imageData);
  
  // Chunk IDAT
  const idat = Buffer.alloc(compressed.length + 12);
  idat.writeUInt32BE(compressed.length, 0);
  idat.write('IDAT', 4);
  compressed.copy(idat, 8);
  const idatCrc = require('zlib').crc32(idat.slice(4, 8 + compressed.length));
  idat.writeUInt32BE(idatCrc, 8 + compressed.length);
  
  // Chunk IEND
  const iend = Buffer.from([0, 0, 0, 0, 73, 69, 78, 68, 174, 66, 96, 130]);
  
  return Buffer.concat([header, ihdr, idat, iend]);
};

try {
  fs.writeFileSync('icon-192.png', createPNG(192));
  fs.writeFileSync('icon-512.png', createPNG(512));
  console.log('✅ Icônes PNG créées avec succès!');
  
  const stat192 = fs.statSync('icon-192.png');
  const stat512 = fs.statSync('icon-512.png');
  console.log(`icon-192.png: ${stat192.size} bytes`);
  console.log(`icon-512.png: ${stat512.size} bytes`);
} catch (err) {
  console.error('❌ Erreur:', err.message);
}

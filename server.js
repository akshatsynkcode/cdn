const express = require('express');
const path = require('path');
const app = express();
const cors = require('cors');
const PORT = 7000;

// Serve static files from the "cdn/cdn" directory (correct path)
app.use(express.static(path.join(__dirname, 'cdn', 'cdn')));  // Serving static files from /home/ubuntu/cdn/cdn
app.use(cors());
// Route to serve the index.html file
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));  // Serving index.html from /home/ubuntu/cdn
});

// Start the server
app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});

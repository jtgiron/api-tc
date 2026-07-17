require('dotenv').config();
const app = require('./app');
const scheduler = require('./src/scheduler');
const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  scheduler.start();
});

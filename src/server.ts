import "dotenv/config";
import app from "./app.js";

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}/api/v1`);
  console.log(`📚 Swagger docs at http://localhost:${PORT}/api-docs`);
  console.log(`🧪 Test frontend at http://localhost:${PORT}/test`);
});
const express = require("express");

const app = express();
const port = process.env.PORT || 8080;

app.get("/health", (req, res) => {
  res.status(200).json({
    ok: true,
    service: "gateway-ia",
    ts: new Date().toISOString(),
  });
});

app.get("/", (req, res) => {
  res.status(200).send("gateway-ia online");
});

app.listen(port, () => {
  console.log(`gateway-ia listening on port ${port}`);
});

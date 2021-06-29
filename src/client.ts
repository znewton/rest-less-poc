import path from "path";
import express from "express";
import { catch404, handleError } from "./utils";

const app = express();
const port = 3001;

app.use(express.static(path.resolve(__dirname, "./public")));

app.get('/', (req, res) => {
  res.sendFile(path.resolve(__dirname, "../src/index.html"));
});

app.use(catch404());
app.use(handleError(app.get("env") === "development"));

app.listen(port, () => {
  console.log(`App listening at http://localhost:${port}`)
});

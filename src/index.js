import express from "express";
import * as api from "./api.js";

let isCrawling = { status: false };

const app = express();

app.get("/", (req, res) => {
    res.send("Hello World!");
});
app.get("/books", api.getBooks);
app.get("/stat", api.storageStat);
app.get("/crawl", api.crawl(isCrawling));

app.listen(3000, async () => {
    console.log(`Server is running on port: 3000`);
});

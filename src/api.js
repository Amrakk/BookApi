import fs from "fs";
import { Worker } from "worker_threads";

export const getBooks = async (req, res) => {
    let { sku, title, author, limit } = req.query;

    let data = undefined;
    try {
        let files = await fs.promises.readdir("products.json");
        let randomIndex = Math.floor(Math.random() * files.length);

        let file = JSON.parse(await fs.promises.readFile(`products.json/${files[randomIndex]}`));
        randomIndex = Math.floor(Math.random() * file.length);

        data = file[randomIndex];
    } catch (err) {
        console.log(err);
    }

    if (!data) return res.json({ message: "No books found" });
    return res.json({ message: "Get random book", data: data });
};

export const storageStat = async (req, res) => {
    let size = 0;
    let files = [];
    let bookCount = 0;

    try {
        files = await fs.promises.readdir("products.json");
        bookCount = JSON.parse(await fs.promises.readFile("./product_links.json")).length;

        let res = [];
        for (let file of files) {
            res.push(fs.promises.stat(`products.json/${file}`));
        }

        let stats = await Promise.all(res);
        size = stats.map((stat) => stat.size).reduce((acc, size) => acc + size, 0);
    } catch (err) {
        console.log(err);
    }

    let data = { total: files.length, size: size, bookCount: bookCount };
    return res.json({ message: "Storage statistics", data: data });
};

export const crawl = (isCrawling) => {
    return async (req, res) => {
        let pass = req.query.pass;
        if (pass !== "4mr4kk") return res.json({ message: "Invalid password" });

        if (isCrawling.status) return res.json({ message: "Crawling in progress. Please wait!" });
        isCrawling.status = true;
        crawlWorker(isCrawling);
        return res.json({ message: "Crawling started" });
    };
};

const crawlWorker = (isCrawling) => {
    const worker = new Worker("./src/crawl.js");
    worker.on("error", (err) => console.log(err));
    worker.on("exit", (code) => {
        isCrawling.status = false;
        console.log(`Worker stopped with exit code ${code}`);
    });
};

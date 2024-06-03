import fs from "fs";
import { v4 } from "uuid";
import Queue from "./queue.js";
import { formats } from "./constants.js";
import axios, { AxiosError } from "axios";
import { parentPort } from "worker_threads";

const limit = 150;
const pageFetchLimit = 8;
const productFetchLimit = 20;
const host = "https://nxbkimdong.com.vn";
const allProductUrl = host + "/collections/all";
const blacklist = ["combo", "bosxet", "boxset", "lich-treo-tuong"];

const getAllProductLinks = async () => {
    let productLinks = new Set();
    let productLinkRegex = /href="\/products\/[^"]+"/g;
    let page = 1;

    let id = setInterval(() => {
        console.log(`Fetching page ${page}`);
    }, 3000);

    while (true) {
        let reqs = [];
        for (let i = 0; i < pageFetchLimit; i++) reqs.push(axios.get(allProductUrl + "?page=" + page++));

        let res = await Promise.allSettled(reqs);

        let data = res
            .filter((r) => r.status === "fulfilled")
            .map((r) => r.value.data)
            .toString();

        let match = data.match(productLinkRegex);

        if (match === null) break;

        match.forEach((link) => {
            if (blacklist.some((e) => link.toLowerCase().includes(e))) return;
            productLinks.add(link.split('"')[1]);
        });
    }

    clearInterval(id);

    fs.writeFileSync("product_links.json", JSON.stringify([...productLinks]));
    console.log("Done!");
};

const getAllProductDetails = async () => {
    let productLinks = JSON.parse(fs.readFileSync("./product_links.json"));

    if (fs.existsSync("products.json")) fs.rmSync("products.json", { recursive: true });
    fs.mkdirSync("products.json", { recursive: true });

    let productDetails = new Queue();
    let writeFilePromises = [];
    let i = 0;
    let sec = 0;

    let id = setInterval(() => {
        console.log(`Progress: ${i}/${productLinks.length} - ${(sec += 3)}s`);
    }, 3000);

    for (; i < productLinks.length; await new Promise((resolve) => setTimeout(resolve, 1000))) {
        let reqs = [];
        for (let j = 0; j < productFetchLimit; j++) reqs.push(getProductDetails(productLinks[i++]));

        let res = await Promise.allSettled(reqs);
        let data = res.filter((r) => r.status === "fulfilled").map((r) => r.value);

        res.filter((r) => r.status === "rejected").forEach((r) => console.log(r.reason));

        if (data.length === 0) {
            console.log(res);
            break;
        }

        data.forEach((productDetail) => {
            if (productDetail === undefined) return;
            productDetails.enqueue(productDetail);
        });

        if (productDetails.size() >= limit) writeFilePromises.push(writeFilePromise(productDetails.dequeueAll()));
    }

    clearInterval(id);
    console.log(`Progress: ${i}/${productLinks.length}`);

    if (productDetails.size() > 0) writeFilePromises.push(writeFilePromise(productDetails.dequeueAll()));

    await Promise.all(writeFilePromises);
    console.log("Done!");
};

export const getProductDetails = async (productLink) => {
    if (productLink === undefined) return undefined;
    let productUrl = host + productLink;
    let res = await axios.get(productUrl).catch((err) => {
        if (err instanceof AxiosError) throw new Error(`Error fetching ${productUrl}: ${err.code} - ${err.message}`);
    });

    let data = res.data.replace(/&nbsp;|\t|\n+/g, "");
    let match = null;

    let skuRegex = /data-sku="([^"]*)"/;
    let sku = null;

    match = data.match(skuRegex);
    try {
        if (match) sku = match[1];
        else {
            skuRegex = /<div class="field-item even sku-number">([^<]*)<\/div>/;
            match = data.match(skuRegex);
            if (match) sku = match[1];
            else {
                skuRegex =
                    /<span class="field-label">Mã Kim Đồng:<\/span>\s*<span class="field-items">\s*<span class="field-item even">(.*?)<\/span>\s*<\/span>\s*<\/span>/;
                match = data.match(skuRegex);
                sku = match ? match[1] : null;
            }
        }
    } catch (e) {}

    let titleRegex = /<h1 itemprop="name">[^<]+<\/h1>/;
    let title = data.match(titleRegex)[0].split(">")[1].split("<")[0];

    let authors = [];
    let authorsRegex = /<li(?: style="text-align: justify;")?>Tác giả:(.*?)<\/li>/s;
    let authorExtractRegex = /<a href="[^"]*">([^<]*)<\/a>|Tác giả:\s*([^<]*)<br>/g;

    match = data.match(authorsRegex);
    try {
        if (match) {
            let authorSection = match[0];
            let authorMatch;

            while ((authorMatch = authorExtractRegex.exec(authorSection)) !== null) {
                if (authorMatch[1]) authors.push(authorMatch[1]);
                else if (authorMatch[2]) authors.push(authorMatch[2].trim());
            }
        } else {
            authorsRegex =
                /<span class="field-label">Tác giả:<\/span>\s*<span class="field-items">(.*?)<\/span>\s*<\/span>/s;
            authorExtractRegex = /<span class="field-item (?:even|odd)">([^<]*|<a [^>]*>[^<]*<\/a>)<\/span>/g;

            let authorsMatch = data.match(authorsRegex);
            if (authorsMatch) {
                let authorSection = authorsMatch[1] + "</span>";
                let authorMatch;

                while ((authorMatch = authorExtractRegex.exec(authorSection)) !== null) {
                    let authorItem = authorMatch[1].trim();
                    let authorNameMatch = authorItem.match(/<a[^>]*>([^<]*)<\/a>/);
                    let authorName = authorNameMatch ? authorNameMatch[1] : authorItem;
                    if (authorName) authors.push(authorName);
                }
            }
        }
    } catch (e) {}

    let pagesRegex = /<li(?: style="text-align: justify;")?>Số trang:(.*?)<\/li>/s;
    let pages = null;

    match = data.match(pagesRegex);
    try {
        if (match) pages = parseInt(data.match(pagesRegex)[0].split(">Số trang:")[1].split("<")[0]);
        else {
            pagesRegex =
                /<span class="field-label">Số trang:<\/span>\s*<span class="field-items">\s*<span class="field-item even">(.*?)<\/span>\s*<\/span>\s*<\/span>/;
            match = data.match(pagesRegex);
            pages = match ? parseInt(match[1]) : null;
        }
    } catch (e) {}

    let formatRegex = /<li(?: style="text-align: justify;")?>Định dạng:(.*?)<\/li>/s;
    let format = null;

    match = data.match(formatRegex);
    try {
        if (match) format = match[0].split(">Định dạng:")[1].split("<")[0].trim();
        else {
            formatRegex =
                /<span class="field-label">Định dạng:<\/span>\s*<span class="field-items">\s*<span class="field-item even">(.*?)<\/span>\s*<\/span>\s*<\/span>/;
            match = data.match(formatRegex);
            format = match ? match[1].trim() : null;
        }
        let index = format ? Object.values(formats).indexOf(format.toLowerCase()) : -1;
        format = index === -1 ? format : Object.keys(formats)[index];
    } catch (e) {}

    let weightRegex = /<li(?: style="text-align: justify;")?>Trọng lượng:(.*?)<\/li>/s;
    let weight = null;

    match = data.match(weightRegex);
    try {
        if (match)
            weight = parseFloat(
                match[0].split(">Trọng lượng:")[1].split("<")[0].trim().split(" ")[0].replaceAll(".", "")
            );
        else {
            weightRegex =
                /<span class="field-label">Trọng lượng:<\/span>\s*<span class="field-items">\s*<span class="field-item even">(.*?)<\/span>\s*<\/span>\s*<\/span>/;
            match = data.match(weightRegex);
            weight = match ? parseFloat(match[1].trim().split(" ")[0].replaceAll(".", "")) : null;
        }
    } catch (e) {}

    let dimensionsRegex = /<li(?: style="text-align: justify;")?>Khuôn Khổ:(.*?)<\/li>/s;
    let dimensions = null;
    match = data.match(dimensionsRegex);

    try {
        if (match) dimensions = data.match(dimensionsRegex)[0].split(">Khuôn Khổ:")[1].split("<")[0].trim();
        else {
            dimensionsRegex =
                /<span class="field-label">Khuôn Khổ:<\/span>\s*<span class="field-items">\s*<span class="field-item even">(.*?)<\/span>\s*<\/span>\s*<\/span>/;
            match = data.match(dimensionsRegex);
            dimensions = match ? match[1].trim() : null;
        }
    } catch (e) {}

    let imageRegex = /<li class="thumbnail-item">([\s\S]*?)<\/li>/;
    let image = null;
    try {
        image = "https:" + data.match(imageRegex)[0].split('href="')[1].split('"')[0];
    } catch (e) {}

    let reference = host + productLink;

    return {
        sku,
        title,
        authors,
        pages,
        format,
        weight,
        dimensions,
        image,
        reference,
    };
};

const writeFilePromise = (productDetails) => {
    let fid = v4();
    return fs.promises.writeFile(`products.json/${fid}.json`, JSON.stringify(productDetails));
};

await getAllProductLinks();
await getAllProductDetails();

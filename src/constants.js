export const formats = {
    Softcover: "bìa mềm",
    Hardcover: "bìa cứng",
};

class Book {
    sku;
    title;
    authors;
    pages;
    format;
    weight;
    dimensions;
    image;
    reference;

    constructor(sku, title, authors, pages, format, weight, dimensions, image, reference) {
        this.sku = sku ?? "";
        this.title = title ?? "";
        this.authors = authors ?? [];
        this.pages = pages ?? 0;
        this.format = format ?? "";
        this.weight = weight ?? 0;
        this.dimensions = dimensions ?? "";
        this.image = image ?? "";
        this.reference = reference ?? "";
    }
}

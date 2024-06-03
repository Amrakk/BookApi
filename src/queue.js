export default class Queue {
    constructor() {
        this.queue = [];
    }

    enqueue(element) {
        return this.queue.push(element);
    }

    dequeue() {
        if (this.queue.length > 0) {
            return this.queue.shift();
        }
    }

    dequeueAll() {
        return this.queue.splice(0, this.queue.length);
    }

    peek() {
        return this.queue[this.queue.length - 1];
    }

    size() {
        return this.queue.length;
    }

    isEmpty() {
        return this.queue.length == 0;
    }

    clear() {
        this.queue = [];
    }
}

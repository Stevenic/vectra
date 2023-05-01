"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.normalizedCosineSimilarity = exports.cosineSimilarity = exports.normalize = exports.dotProduct = void 0;
function dotProduct(arr1, arr2) {
    // Initialize a variable to store the sum of the products
    let sum = 0;
    // Loop through the elements of the arrays
    for (let i = 0; i < arr1.length; i++) {
        // Multiply the corresponding elements and add them to the sum
        sum += arr1[i] * arr2[i];
    }
    // Return the sum
    return sum;
}
exports.dotProduct = dotProduct;
function normalize(arr) {
    // Initialize a variable to store the sum of the squares
    let sum = 0;
    // Loop through the elements of the array
    for (let i = 0; i < arr.length; i++) {
        // Square the element and add it to the sum
        sum += arr[i] * arr[i];
    }
    // Return the square root of the sum
    return Math.sqrt(sum);
}
exports.normalize = normalize;
function cosineSimilarity(arr1, arr2) {
    // Return the quotient of the dot product and the product of the norms
    return dotProduct(arr1, arr2) / (normalize(arr1) * normalize(arr2));
}
exports.cosineSimilarity = cosineSimilarity;
function normalizedCosineSimilarity(arr1, norm1, arr2, norm2) {
    // Return the quotient of the dot product and the product of the norms
    return dotProduct(arr1, arr2) / (norm1 * norm2);
}
exports.normalizedCosineSimilarity = normalizedCosineSimilarity;
//# sourceMappingURL=utilities.js.map
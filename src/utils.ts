export function numToUint8Array(num:any) {
    let arr = new Uint8Array(8);
  
    for (let i = 0; i < 8; i++) {
      arr[i] = num % 256;
      num = Math.floor(num / 256);
    }
    return arr;
}

export function concatenateUint8Arrays(jsonData:any) {
    // Extract the keys and convert to Uint8Array
    const arrays = Object.keys(jsonData).map(key => new Uint8Array(jsonData[key]));

    // Calculate the total length of the combined array
    const totalLength = arrays.reduce((sum, arr) => sum + arr.length, 0);
    // Create a new Uint8Array to hold the combined data
    const combinedArray = new Uint8Array(totalLength);
    // Copy the data from each array into the combined array
    let offset = 0;
    arrays.forEach(arr => {
        combinedArray.set(arr, offset);
        offset += arr.length;
    });
    return combinedArray;
}

export function breakStringIntoNParts(str:string, n:number) {
    let partLength = Math.ceil(str.length / n);
    let parts = [];

    for (let i = 0; i < str.length; i += partLength) {
        parts.push(str.substring(i, i + partLength));
    }

    // Ensure there are exactly n parts
    while (parts.length < n) {
        parts.push('');
    }

    return parts;
}
import { Mina, PublicKey, UInt32,Field,  ZkProgram, Bytes, Hash, state, Bool, verify, Struct, Provable} from 'o1js';

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

export class Commitments extends Struct({
    availableSupply: Field, timestamp: Field
  }){
    constructor(value:{availableSupply: Field, timestamp: Field}){
      super(value)
    }
}
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

/**
 * 
 * * The function searches for import statements, in the supplied string, of the form:
 * 
 * ```javascript
 * import { ... } from 'zkon-zkapp';
 * ```
 * 
 * The ZkonRequestCoordinator.js can at max export:
 * 1. ExternalRequestEvent
 * 2. ZkonProof
 * 3. ZkonRequestCoordinator
 * 
 * The zkProgram.js can at max export:
 * 1. ZkonZkProgram
 * 2. PublicArguments
 * 3. ECDSAHelper 
 * 
 * The approach will be in 3 steps:
 * 1. To find the import statement of 'zkon-zkapp'. 
 * 2. Find which exports are present in the import
 * 3. Then reconstruct new import lines based on which exports are present
 * 
 * 
 * @param {string} inputString - The entire zkProgram as a string, which needs to be processed.
 * 
 * @returns A modified string with the original import statement replaced by new import lines 
 *          based on the identified imports, or null if an error occurs.
 * 
 * @throws TypeError If the input `bigString` is not a string.
 * @throws Error If no relevant imports are found in the input string.
 * 
 *  @example
 * const code = `
 *   // Some content
 *   import { ZkonZkProgram, ZkonRequestCoordinator, ExternalRequestEvent } from 'zkon-zkapp';
 *   // Some more content
 * `;
 * 
 * const result = replaceImports(code);
 * console.log(result);
 * // Output:
 * // `
 * //   // Some content
 * //   import { ExternalRequestEvent, ZkonRequestCoordinator } from 'zkcoordinator.js';
 * //   import { ZkonZkProgram } from 'zkProgram.js';
 * //   // Some more content
 * // `
*/
export function fixImports(inputString: string): string|null {
    try{
        const regex = /import\s+{[^}]+}\s+from\s+'zkon-zkapp';/g;
        const matches = inputString.match(regex);
  
        if (!matches) { 
            return inputString
        }

        // Step1: Define the set of imports to check for
        const group1: string[] = ['ExternalRequestEvent', 'ZkonProof', 'ZkonRequestCoordinator'];
        const group2: string[] = ['ZkonZkProgram', 'PublicArguments', 'ECDSAHelper'];
        
        // Step2: Initialize found groups based on matched imports
        const foundGroup1:  string[] = group1.filter(importName => matches.some(match => match.includes(importName)));
        const foundGroup2:  string[] = group2.filter(importName => matches.some(match => match.includes(importName)));

        if (foundGroup1.length === 0 && foundGroup2.length === 0) {
            throw new Error('No relevant imports found in the string.');
        }
        
        // Step3: Construct the additional import lines
        let additionalImports = '';
            
        if (foundGroup1.length > 0) {
            additionalImports += `import { ${foundGroup1.join(', ')} } from 'zkcoordinator.js';\n`;
        }
        
        if (foundGroup2.length > 0) {
            additionalImports += `import { ${foundGroup2.join(', ')} } from 'zkProgram.js';\n`;
        }
        
        const finalOutput = additionalImports.trim();
        const updatedString = inputString.replace(regex, finalOutput);
        return updatedString
    }catch(error){
        console.error('Error while replacing imports:', (error as Error).message);
        return null; // Return null or a default value to indicate failure
    }
}
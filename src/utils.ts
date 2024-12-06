import {Bytes, ForeignCurveV2, assert, UInt8, Field, Provable, Bool} from 'o1js';

const l = 88n;

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

export function replaceImports(codeString: string): string | null {
    if (typeof codeString !== 'string') {
      throw new TypeError('Input must be a string.');
    }

    // Update the regex to also capture aliases (e.g., ZkonZkProgram as J)
    const regex = /import\s*{([^}]+)}\s*from\s*['"]zkon-zkapp['"];?/g;
    const matches = codeString.match(regex);

    if (!matches) {
      return codeString;
    }

    // Extracting the import list inside the curly braces
    const importStatement = matches[0];
    const imports = importStatement.match(/{([^}]+)}/)?.[1].split(',').map(i => i.trim());

    console.log(imports);

    if (!imports) {
      return codeString;
    }

    const group1: string[] = ['ExternalRequestEvent', 'ZkonProof', 'ZkonRequestCoordinator'];
    const group2: string[] = ['ZkonZkProgram', 'PublicArguments', 'ECDSAHelper'];
    const group3: string[] = ['StringCircuitValue']

    // Find matching imports for both groups
    const foundGroup1: string[] = [];
    const foundGroup2: string[] = [];
    const foundGroup3: string[] = [];

    imports.forEach(importItem => {
      const [importName, alias] = importItem.split(/\s+as\s+/); // Handle aliases
      const normalizedImport = importName.trim();

      if (group1.includes(normalizedImport)) {
        foundGroup1.push(alias ? `${normalizedImport} as ${alias.trim()}` : normalizedImport);
      } else if (group2.includes(normalizedImport)) {
        foundGroup2.push(alias ? `${normalizedImport} as ${alias.trim()}` : normalizedImport);
      } else if (group3.includes(normalizedImport)) {
        foundGroup3.push(alias ? `${normalizedImport} as ${alias.trim()}` : normalizedImport);
      } 
    });

    // If no matches from either group, throw an error
    if (foundGroup1.length === 0 && foundGroup2.length === 0 && foundGroup3.length === 0) {
      throw new Error('No relevant imports found in the string.');
    }

    // Prepare the new import lines
    let additionalImports = '';

    if (foundGroup1.length > 0) {
      additionalImports += `import { ${foundGroup1.join(', ')} } from './ZkonRequestCoordinator.js';\n`;
    }

    if (foundGroup2.length > 0) {
      additionalImports += `import { ${foundGroup2.join(', ')} } from './zkProgram.js';\n`;
    }

    if (foundGroup3.length > 0) {
        additionalImports += `import { ${foundGroup3.join(', ')} } from './String.js';\n`;
    }

    console.log(codeString.includes('from"zkon-zkapp"'))
    let returnString = codeString.replace(importStatement, additionalImports.trim());

    //EdgeCase: Handle StringCircuitValue case: Suggest developers to stick to importing just one import {...} from "zkon-zkapp"
    if(returnString.includes('from"zkon-zkapp"')){
        returnString = returnString.replace('from"zkon-zkapp"', 'from"./String.js"')
        return returnString
    }

    return returnString
}

export function keccakOutputToScalar(hash: Bytes, Curve: typeof ForeignCurveV2) {
    const L_n = Curve.Scalar.sizeInBits;
    // keep it simple for now, avoid dealing with dropping bits
    // TODO: what does "leftmost bits" mean? big-endian or little-endian?
    // @noble/curves uses a right shift, dropping the least significant bits:
    // https://github.com/paulmillr/noble-curves/blob/4007ee975bcc6410c2e7b504febc1d5d625ed1a4/src/abstract/weierstrass.ts#L933
    assert(L_n === 256, `Scalar sizes ${L_n} !== 256 not supported`);
    assert(hash.length === 32, `hash length ${hash.length} !== 32 not supported`);
  
    // piece together into limbs
    // bytes are big-endian, so the first byte is the most significant
    assert(l === 88n);
    let x2 = bytesToLimbBE(hash.bytes.slice(0, 10));
    let x1 = bytesToLimbBE(hash.bytes.slice(10, 21));
    let x0 = bytesToLimbBE(hash.bytes.slice(21, 32));
  
    return new Curve.Scalar.AlmostReduced([x0, x1, x2]);
}

export function bytesToLimbBE(bytes_: UInt8[]) {
    let bytes = bytes_.map((x) => x.value);
    let n = bytes.length;
    let limb = bytes[0];
    for (let i = 1; i < n; i++) {
      limb = limb.mul(1n << 8n).add(bytes[i]);
    }
    return limb.seal();
}

export function checkHash(bytes_: UInt8[]): Bool {

    let checkZero=Field(0);
    //Provable.log("CheckZero-pre-check:",checkZero)

    let bytes = bytes_.map((x)=> {
        //Provable.log(x.value, x.value.equals(0))
        const check = x.value.equals(Field(0))
        const checkZeroInt = Provable.if(
            check,
            Field(1),
            Field(0)
        )
        //Provable.log("Inside Map:", checkZeroInt)
        checkZero = checkZero.add(checkZeroInt);
        return x
    })

    Provable.log("CheckZero:",checkZero);
    assert(checkZero.lessThan(32), "Zero-hash!")

    let n = bytes.length;
    Provable.log("Length:",n);
    assert(n === 32, "Length greater than 32!")
    return Bool(true)
}
import { Struct, Field } from 'o1js';

class ByteArray extends Struct({
    data: [Field]
  }) {
    constructor(data: Field[]) {
      super({data});
      this.data = data;
    }
  
    static fromString(str: string): ByteArray {
      const encoder = new TextEncoder();
      const bytes = encoder.encode(str);
      const fields = Array.from(bytes).map(byte => Field(byte));
      return new ByteArray(fields);
    }
  
    toString(): string {
      const decoder = new TextDecoder();
      const byteArray = Uint8Array.from(this.data.map(field => Number(field.toBigInt())));
      return decoder.decode(byteArray);
    }
}

export default ByteArray;
  
export class RealtimeUtils {
  static base64ToArrayBuffer(base64: string): ArrayBuffer {
    const binaryString = atob(base64);
    const len = binaryString.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    return bytes.buffer;
  }

  static mergeInt16Arrays(array1: Int16Array, array2: Int16Array): Int16Array {
    const result = new Int16Array(array1.length + array2.length);
    result.set(array1, 0);
    result.set(array2, array1.length);
    return result;
  }
}
// fetch() can't report upload progress, so presigned PUTs go through XHR
export function putWithProgress(url: string, file: File, headers: Record<string, string>, onProgress: (p: number) => void) {
  return new Promise<void>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("PUT", url);
    Object.entries(headers).forEach(([k, v]) => xhr.setRequestHeader(k, v));
    xhr.upload.onprogress = (e) => e.lengthComputable && onProgress(Math.round((e.loaded / e.total) * 100));
    xhr.onload = () => (xhr.status >= 200 && xhr.status < 300 ? resolve() : reject(new Error(`Cloud storage rejected the upload (HTTP ${xhr.status})`)));
    xhr.onerror = () => reject(new Error("Couldn't reach cloud storage. Check the bucket's CORS rule allows PUT from this site"));
    xhr.send(file);
  });
}

/* eslint-disable no-restricted-globals */
self.onmessage = (e: MessageEvent<string>) => {
  console.log("hi", e.data);
};

export {};

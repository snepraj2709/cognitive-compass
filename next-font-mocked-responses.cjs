module.exports = new Proxy(
  {},
  {
    get: (_target, key) => {
      if (typeof key !== "string") {
        return undefined;
      }

      return "@font-face { font-family: '__MockedGoogleFont'; src: local('Arial'); }";
    },
  },
);

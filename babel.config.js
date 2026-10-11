module.exports = function (api) {
  api.cache(true);
  return {
    presets: ['babel-preset-expo'],
    // Permite importar los .sql de drizzle/ como texto (los usa migrations.js)
    plugins: [['inline-import', { extensions: ['.sql'] }]],
  };
};

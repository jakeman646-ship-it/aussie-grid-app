Remove-Item postcss.config.js -Force -ErrorAction SilentlyContinue
@"
export default {
  plugins: {
    tailwindcss: {},
    autoprefixer: {},
  },
};
"@ | Set-Content postcss.config.js -Encoding UTF8
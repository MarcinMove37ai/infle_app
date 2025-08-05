/** @type {import('tailwindcss').Config} */
module.exports = {
  content: {
    files: [
      "./src/**/*.{js,ts,jsx,tsx}"
    ],
    // Wykluczenie folderu z danymi
    exclude: [
      "./ignore_py_files/**/*",
      "./node_modules/**/*",
      "./.next/**/*"
    ]
  }
}
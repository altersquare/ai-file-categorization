# AI File Categorization

AI-powered application for categorizing files in a zip archive using Google's Gemini AI.

## Environment Variables

This application uses environment variables for configuration. To set up your environment:

1. Copy the `.env.example` file to a new file named `.env`:
   ```
   cp .env.example .env
   ```

2. Edit the `.env` file and add your Google Gemini API key and other configuration options:
   ```
   GEMINI_API_KEY=your_gemini_api_key_here
   PORT=3000
   GEMINI_MODEL=gemini-pro
   ```

### Required Environment Variables

- `GEMINI_API_KEY`: Your Google Gemini API key (required for AI categorization)

### Optional Environment Variables

- `PORT`: The port number for the server (default: 3000)
- `GEMINI_MODEL`: The Gemini model to use for categorization (default: gemini-pro)

## Running the Application

### Development Mode

```
npm run dev
```

### Production Mode

```
npm start
```

## Features

- Upload zip files containing various file types
- AI-powered categorization of files using Google's Gemini AI
- Automatic organization of files by category
- Support for various file types including text, images, documents, and more

# Advanced Scientific Paper Generator - User Manual

<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

## 1. Introduction

The "Advanced Scientific Paper Generator" is a powerful, AI-driven application designed to drastically simplify the scientific paper creation process. Starting with a broad mathematical topic, the tool generates an innovative paper title and then drafts a complete LaTeX document based on that title. What truly sets this tool apart is its multi-iteration analysis system, which rigorously evaluates the generated paper against 28 distinct quality metrics. Based on this analysis, the AI iteratively refines the paper, ensuring a high standard of academic quality and consistency. To top it off, it includes a dedicated "Fixer" tool to resolve common LaTeX compilation issues.

This tool is ideal for researchers, students, and academics looking for an intelligent assistant to kickstart their writing process, refine drafts, or explore new research directions with AI-generated insights.

**Author:** SÉRGIO DE ANDRADE, PAULO
Graduate of the Mathematics Course, Faculdade de Guarulhos (FG), Guarulhos, São Paulo.
Email: andradepsa@gmail.com.
Lattes ID: 7286865766488458.
ORCID: https://orcid.org/0009-0004-2555-3178

**DOI (Zenodo):** 10.5281/zenodo.17425500

## 2. Key Features

*   **AI Title Generation:** Generates a novel and high-impact research paper title from a broad mathematical topic.
*   **Complete LaTeX Paper Generation:** Produces a full scientific paper, including an abstract, introduction, methodology, results, discussion, conclusion, and a formatted bibliography, all in valid LaTeX.
*   **Iterative Quality Analysis:** Performs up to 12 analysis iterations, evaluating the paper on 28 quality metrics (e.g., Topic Focus, Writing Clarity, Methodological Rigor, LaTeX Technical Accuracy).
*   **Intelligent Paper Improvement:** Based on the analysis, the AI iteratively refines the LaTeX source code to address identified weaknesses.
*   **Early Analysis Completion:** The analysis process stops early if the paper reaches a high quality standard (no "red" scores), saving time and computational resources.
*   **Multi-language Support:** Generate papers and receive feedback in Portuguese, English, Spanish, or French.
*   **Flexible Model Selection:** Choose between "fast" (Gemini 2.5 Flash) and "powerful" (Gemini 2.5 Pro) AI models for different tasks, optimizing for speed and quality.
*   **Adjustable Paper Length:** Specify the desired number of pages for the generated paper.
*   **Google Search Grounding:** Integrates Google Search to find relevant and up-to-date academic sources for bibliography generation.
*   **LaTeX "Fixer" Modal:** A dedicated tool to automatically diagnose and fix common LaTeX compilation issues, such as character escaping, citation mismatches, and preamble validation.
*   **Cost Optimization:** Strategic model usage and early stopping minimize API token consumption and operational costs.

## 3. How to Use the Application

The application will guide you through a clear and intuitive three-step process to generate and refine your scientific paper directly within the Google AI Studio interface.

### 3.1 Step 1: Configuration

This section allows you to set the basic parameters for your paper and the AI models.

#### 3.1.1 Select Language

*   **Purpose:** To choose the language in which your paper will be generated and in which the AI will communicate.
*   **How to Use:** In the "Step 1: Configuration" section, you will see buttons with flags and language names (e.g., "🇬🇧 English", "🇧🇷 Português"). Click the button corresponding to your desired language. The interface will update, and all generated content will be in that language.

#### 3.1.2 Choose AI Models

*   **Purpose:** To configure which AI models the application will use for different phases of the process. We recommend sticking to the default suggestions for the best balance of speed and quality.
*   **How to Use:** Below the language selection, you will find two categories:
    *   **Fast Model (for analysis):** This model is faster and more efficient for high-frequency tasks, such as paper quality analysis and initial title generation. `gemini-2.5-flash` is generally the default and recommended.
    *   **Powerful Model (for generation):** This model is more robust and ideal for complex tasks requiring advanced reasoning, such as generating the initial paper content and iterative improvements. `gemini-2.5-pro` is generally the default and recommended.
    *   For each category, click the model button you wish to select. A brief description of each model is provided to help your choice.

#### 3.1.3 Define Paper Length

*   **Purpose:** To determine the approximate number of pages you want for the final LaTeX document.
*   **How to Use:** At the bottom of the "Step 1: Configuration" section, you will see buttons with page count options (e.g., "12 Pages", "30 Pages"). Click your desired option. The AI will adjust the depth and breadth of the content to try and meet this requirement.

### 3.2 Step 2: Generate Paper

This is the crucial step where the paper generation and iterative analysis process is initiated.

*   **Purpose:** To start the entire workflow: title generation, paper writing, and subsequent iterative analysis and improvement.
*   **How to Use:** In the "Step 2: Generate Paper" section, click the **"Generate paper"** button.
*   **Process Flow (What to expect):**
    1.  **"Generating Title...":** The application will first generate a new and impactful title based on a randomly selected mathematical topic. You will see this title displayed in the "Results" section once it's ready.
    2.  **"Generating Paper...":** Next, the AI will write the complete scientific paper in LaTeX format, using the generated title and consulting external sources via Google Search to ground the content and bibliography.
    3.  **"Analyzing...":** The main iterative process begins. The AI will analyze the paper against the 28 metrics, provide detailed feedback, and then attempt to improve the paper. This cycle will repeat for several iterations (up to 12).
*   **Progress Bar:** A progress bar will appear in the "Results" section, showing the overall progress of the generation and analysis.
*   **Early Analysis Completion:** If the paper reaches a high quality standard (no "red" scores) before all iterations are completed, a **"✅ Analysis complete!"** message will appear, and the process will stop early, saving you time.

### 3.3 Step 3: Analyze Results

Once the process is complete (or has stopped early), you can review the results in detail.

#### 3.3.1 Generated LaTeX Source Code

*   **Purpose:** To display the final LaTeX source code of your scientific paper.
*   **Location:** This code will appear in a large, scrollable text area on the left side of the "Results" section.
*   **Important:** This is the file you can copy and use in any LaTeX editor (like Overleaf, TeXmaker, or online compilers like LaTeX-online.cc) to generate your PDF.

#### 3.3.2 Copy the Paper

*   **Purpose:** To easily transfer the LaTeX code to your clipboard for use in an external LaTeX editor.
*   **How to Use:** Click the **"Copy Latex"** button (with a copy icon) located at the top right of the LaTeX code text area. A **"✅ Copied!"** message will appear briefly to confirm success.

#### 3.3.3 LaTeX "Fixer" Tool

*   **Purpose:** To correct common technical compilation issues in the generated LaTeX code. This tool is particularly useful if you encounter errors when trying to compile the paper externally.
*   **How to Use:**
    1.  Click the **"Fixer"** button (wrench icon) located above the LaTeX code text area, on the right side.
    2.  A modal window ("LaTeX Compilation Fixer") will open, listing several correction options (e.g., "Fix Character Escaping," "Fix Citation Mismatches").
    3.  Check the boxes next to the fixes you want to apply.
    4.  Click **"Apply Fixes"**. The AI will process the paper and attempt to correct the selected issues.
    5.  A **"Fixes applied successfully!"** message will confirm the changes. You can then copy the updated LaTeX code.

#### 3.3.4 Iterative Analysis

*   **Purpose:** To provide a detailed breakdown of the AI's multi-iteration review process, showing scores and improvement suggestions for each quality metric.
*   **Location:** This panel will appear on the right side of the "Results" section.
*   **Understanding the Display:**
    *   **Iterations:** Each numbered block (e.g., "═══ ITERATION 1 of 12 ═══") represents one round of analysis and improvement.
    *   **Topic Name:** The specific quality metric being evaluated (e.g., "WRITING CLARITY", "METHODOLOGICAL RIGOR").
    *   **Score:** A numerical score from 0.0 to 10.0, indicating the paper's quality for that metric.
        *   **Green (8.5-10.0):** High quality, little to no improvement needed.
        *   **Yellow (7.0-8.4):** Good quality, but with room for some improvements.
        *   **Red (0.0-6.9):** Requires significant attention and substantial improvements.
    *   **Improvement:** A concise, single-sentence suggestion from the AI on how to improve the paper for that specific topic.

#### 3.3.5 Sources Used

*   **Purpose:** To list the external web sources the AI used to ground the content and generate the paper's bibliography.
*   **Location:** Below the LaTeX code text area.
*   **How to Use:** Click the provided links to view the original source pages in your browser. This allows you to verify the provenance of the information.

## 4. How to Upload and Use in Google AI Studio

This guide details how to upload this project to the Google AI Studio application development environment, where you can run it directly in the browser without complex local setups.

### 4.1 Prerequisites

*   A Google account.
*   Access to [Google AI Studio](https://aistudio.google.com/).
*   The complete "Advanced Scientific Paper Generator" project files on your local computer.

### 4.2 Upload Steps

1.  **Access Google AI Studio:**
    *   Open your browser and go to [https://aistudio.google.com/](https://aistudio.google.com/).
    *   Log in with your Google account if you haven't already.

2.  **Navigate to the "My Apps" Section (or similar):**
    *   On the left sidebar of Google AI Studio, look for an option like "My Apps," "Projects," or "Apps." Click on it. This section is where you manage your web application projects.

3.  **Create a New App:**
    *   Within the apps section, look for a button like "+ New App," "Create Project," or an add icon. Click it to start creating a new application.

4.  **Upload the Project Files:**
    *   Google AI Studio will prompt you to upload your project files.
    *   **Option 1 (Recommended): Drag and Drop.** Locate the root folder of the "Advanced Scientific Paper Generator" project on your computer. Drag and drop the *entire folder* directly onto the designated area in Google AI Studio. The system will upload all files and subfolders automatically.
    *   **Option 2: Select Folder.** Alternatively, you can click the option to "Select Folder" (or "Browse Files") and navigate to the project's root folder on your file system, selecting it for upload.
    *   Wait for the upload to complete. You will see a representation of your project's structure in Google AI Studio.

5.  **Configure the Gemini API Key:**
    *   **Important:** For the application to work, it needs to access your Gemini API Key. Google AI Studio manages this securely, *without you needing to change the application code*.
    *   After the upload, Google AI Studio will usually take you to the settings or details screen for your new app.
    *   Look for a section related to "Environment Variables" or "API Key."
    *   There, you will see an option to **"Select API Key"** or **"Manage API Keys."** Click it.
    *   Select an existing Gemini API key or create a new one if needed. This key will be automatically injected into your application's runtime environment, allowing it to communicate with the Gemini models.
    *   Ensure the selected API key has permissions for the `gemini-2.5-flash` and `gemini-2.5-pro` models.
    *   A link to the billing documentation can be found at: [ai.google.dev/gemini-api/docs/billing](https://ai.google.dev/gemini-api/docs/billing).

6.  **Run the Application:**
    *   With the files uploaded and the API key configured, look for a button like "Run App," "Preview," or a "Play" icon in the Google AI Studio interface.
    *   Click this button to start your "Advanced Scientific Paper Generator." The application will load in a new tab or panel within the Google AI Studio environment, ready for use, exactly as described in the "3. How to Use the Application" section.

You can now use the application directly in the Google AI Studio environment!

## 5. Technical Insights

### AI Models
The application leverages the power of Google's Gemini models:
*   `gemini-2.5-flash`: Used for faster, less resource-intensive tasks, such as initial title generation and iterative analysis.
*   `gemini-2.5-pro`: Employed for more complex tasks that require greater reasoning capabilities, such as initial paper generation and detailed iterative improvements.

### Grounding
The application uses Google Search as a *grounding* tool to ensure the generated content is factually relevant and up-to-date. When the initial paper is generated, the AI queries Google Search for academic sources related to the paper's title and uses them to populate the bibliography.

### Cost and Token Optimization
To minimize API costs and improve efficiency, the system employs several smart strategies:
*   **Intelligent Model Selection:** Faster, more economical models (`gemini-2.5-flash`) are used for frequent tasks (analysis, title generation), while more powerful and expensive models (`gemini-2.5-pro`) are reserved for critical generation and complex improvement steps.
*   **Early Analysis Completion:** The iterative analysis loop is designed to stop as soon as the paper reaches a satisfactory quality level (zero "red" scores). This avoids unnecessary API calls and significantly reduces token consumption.

The table below illustrates the impact of these optimizations, comparing the cost per iteration and the total cycle cost in an early completion scenario.

| Process Step                | Model Used         | Estimated Cost (Before)            | Estimated Cost (Now)                   | Optimization Applied                                           |
| :-------------------------- | :----------------- | :--------------------------------- | :------------------------------------- | :----------------------------------------------------------------- |
| Title Generation            | `gemini-2.5-flash` | ~1,500 tokens                      | **~500 tokens**                        | Using 'flash' model instead of 'pro' for a simple task.            |
| Initial Paper Generation    | `gemini-2.5-pro`   | ~150,000 tokens                    | ~150,000 tokens                        | 'Pro' model maintained for maximum quality in the main generation. |
| Analysis (per iteration)    | `gemini-2.5-flash` | ~130,000 tokens                    | **~45,000 tokens**                     | Using 'flash' model and JSON schema for structured response.       |
| Improvement (per iteration) | `gemini-2.5-pro`   | ~140,000 tokens                    | ~140,000 tokens                        | 'Pro' model maintained for high-quality, surgical refinement.      |
| **Total Iterative Cycle (Ex: 3 iterations)** | **Mixed**          | ~2,080,000 tokens (12 iterations) | **~415,000 tokens**                    | **Early completion** upon reaching quality (no red scores).        |

## 6. Troubleshooting

*   **"An error occurred: You exceeded your current quota...":** This indicates you have hit a rate limit with the API. The application has built-in retry logic, but if the issue persists, wait a minute before trying again.
*   **"Failed to parse analysis JSON...":** This is a rare error indicating that the AI's response for the analysis was not in the expected JSON format. Try running the process again.
*   **LaTeX compilation errors (after copying to an external compiler):** Use the internal "Fixer" tool (Step 3.3.3) to resolve common issues. If problems persist, carefully review the LaTeX source code for syntax errors.

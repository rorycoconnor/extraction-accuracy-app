# Product Requirements Document: Box Accuracy Optimizer

**Author:** App Prototyper (AI Product Manager)  
**Version:** 1.0  
**Date:** July 10, 2024  
**Status:** Proposed

## 1. Executive Summary

The **Box Accuracy Optimizer** is a web-based application that provides a robust, user-friendly workbench for evaluating, comparing, and improving the accuracy of AI-driven metadata extraction from documents stored in Box.

### Primary Goals
- **Primary Goal:** Empower users to achieve >95% accuracy for AI metadata extraction on their key document types
- **Business Objective:** Become an indispensable tool for any Box enterprise customer implementing AI, driving adoption and demonstrating the value of the Box AI platform
- **User Objective:** Drastically reduce the time and effort required to validate and improve AI extraction performance, from weeks to hours
- **Technical Objective:** Build a scalable, secure, and reliable application that serves multiple users and tenants within an enterprise

## 2. Problem Statement

Enterprises using Box for document management are increasingly leveraging AI to extract structured metadata (e.g., contract dates, invoice numbers). However, the accuracy of this extraction can vary significantly depending on the AI model used, the quality of the document, and the clarity of the extraction prompt.

Currently, there is no streamlined way for business analysts, legal tech professionals, and developers to quantitatively measure and improve the performance of AI metadata extraction across different models and prompts. They lack the tools to run side-by-side comparisons, manage a "golden set" of correct data (ground truth), and iteratively refine prompts to maximize accuracy. This leads to inefficient workflows, a lack of trust in AI outputs, and missed opportunities to automate critical business processes.

## 3. User Personas

### 3.1 Priya, the Legal Tech Analyst
- **Role:** Works with thousands of contracts
- **Needs:** Ensure key clauses, dates, and party names are extracted with near-perfect accuracy to feed into a contract lifecycle management (CLM) system
- **Expertise:** Not a developer but expert at defining what "correct" looks like
- **Key Use Case:** Establishing ground truth and validating extraction accuracy

### 3.2 David, the AI/ML Developer
- **Role:** Tasked with building automated workflows that rely on extracted metadata
- **Needs:** Experiment with different models (Gemini, Claude, etc.) and fine-tune prompts to find the optimal combination for performance and cost
- **Expertise:** Technical background, needs detailed debugging information and API logs
- **Key Use Case:** Prompt engineering and model comparison

### 3.3 Maria, the Business Manager
- **Role:** Oversees a department that processes invoices and purchase orders
- **Needs:** High-level dashboards to understand the overall accuracy and ROI of their AI investment
- **Expertise:** Business-focused, needs to know if the system is reliable enough to trust for financial reporting
- **Key Use Case:** Performance monitoring and ROI analysis

## 4. Core Requirements

### 4.1 Secure Authentication & User Management

**Requirement:** Users must log in via a secure authentication system (e.g., OAuth 2.0 with their enterprise identity provider, or email/password).

**User Story:** As Priya, I want to log in with my corporate credentials so that my work is secure and tied to my identity.

**Details:**
- The app must support multi-user environments
- All user-generated data (templates, ground truth, results) must be isolated and associated with their user account or tenant

### 4.2 Persistent Project & Data Storage

**Requirement:** All application data must be stored in a centralized, scalable database (e.g., Firebase Firestore, PostgreSQL), replacing the current localStorage implementation.

**User Story:** As David, I want my comparison results and prompt history to be saved automatically, so I can close my browser and resume my work later without losing anything.

### 4.3 Home: The Comparison Workbench

**Requirement:** An interactive grid for running and comparing AI extraction results.

**Details:**
- **Setup:** Users select a configured Box Metadata Template and a set of files from a designated Box folder
- **Model Selection:** Users can select which AI models (e.g., Box AI Default, Gemini 2.5 Pro, Claude Sonnet) to include in the comparison
- **Run Comparison:**
  - On-click, the backend will call the Box AI API in parallel for each file and each selected model
  - The UI must provide real-time progress feedback (e.g., "Processing 5 of 20 files...")
- **Results Grid:**
  - Display results in a sticky-header table: files as rows, (metadata fields x models) as columns
  - Visually highlight discrepancies between model outputs and the ground truth
  - Display performance metrics (F1 Score, Accuracy) for each model on each field, which can be toggled on/off
  - Display aggregate performance metrics for each model across all files

### 4.4 Prompt Studio

**Requirement:** An interface for editing, versioning, and improving extraction prompts.

**User Story:** As David, I want to edit the prompt for the "Effective Date" field, save it as a new version, and re-run the comparison to see if my F1 score improves.

**Details:**
- Accessible by clicking on a field header in the comparison grid
- Displays the active prompt in an editable textarea
- "Generate Suggestion" button that uses a meta-LLM to suggest a better prompt
- Maintains a version history for each prompt. Users can view past versions and revert to any previous version
- (Future) Each version should be stored with the performance metrics it achieved

### 4.5 Ground Truth Management

**Requirement:** A dedicated interface for establishing the "single source of truth" for metadata.

**User Story:** As Priya, I need to review a document and manually enter the correct values for all its metadata fields, which will serve as the benchmark for all AI models.

**Details:**
- A table listing all files that have been associated with a template
- A status indicator for each file (e.g., "Pending," "Complete")
- An "Edit" mode that opens a two-panel view:
  - **Left Panel:** An embedded Box Preview of the document
  - **Right Panel:** A form with fields corresponding to the metadata template, where the user can input the correct values

### 4.6 Settings & Configuration

**Requirement:** A secure area for administrators to configure the application's connection to Box.

**Details:**
- The backend must securely store Box API credentials (e.g., using a secret manager like Google Secret Manager or HashiCorp Vault)
- The UI allows an admin to input and save either a Service Account config.json or a Developer Token
- Configuration for the target Box Folder ID

## 5. Non-Functional Requirements

### 5.1 Performance
- **Page Load:** The main application shell should load in < 2 seconds
- **API Calls:** Backend processing of extraction requests should run in parallel to minimize wait times. The UI must remain responsive during extraction

### 5.2 Scalability
- The backend must be built on a serverless architecture (e.g., Firebase Functions, Google Cloud Run) to handle variable loads
- The database must support thousands of concurrent users and millions of records

### 5.3 Security
- All data in transit must be encrypted (HTTPS)
- Sensitive credentials (Box API keys) must be stored securely in a secret manager, not in environment variables or code
- User data must be logically separated to prevent data leakage between accounts

### 5.4 Usability & Design
- The UI must adhere to the style guidelines (fonts, colors)
- The application must be fully responsive and functional on modern web browsers (Chrome, Firefox, Safari, Edge) and screen sizes

## 6. Assumptions & Dependencies

### 6.1 Assumptions
- Users will have an enterprise-level Box account with the Box AI API enabled
- Users understand the concept of metadata templates within Box

### 6.2 Dependencies
- The application's core functionality is dependent on the availability and performance of the Box Platform APIs

## 7. Success Metrics

### 7.1 Key Performance Indicators
- **Activation Rate:** % of new users who successfully run their first comparison within 24 hours of signing up
- **Engagement:** Average number of comparison runs per user per week
- **Task Success Rate:** % of users who improve a field's F1 score by at least 10% using the Prompt Studio
- **Retention:** 4-week user retention rate

## 8. Future Enhancements

### 8.1 Advanced Analytics Dashboard
- Visualizations showing model performance over time
- Cost-per-extraction analysis
- Accuracy heatmaps

### 8.2 Automated Ground Truth Suggestions
- Use a "challenger" model to suggest ground truth values, which a human can then approve or correct

### 8.3 CI/CD Integration
- An API endpoint to allow automated testing of prompts as part of a CI/CD pipeline

### 8.4 Bulk Actions
- Ability to apply a new prompt version across multiple fields or templates at once

## 9. Screenshots Reference

The application screenshots demonstrating the current implementation are located in the `../Product Screenshots/` directory:

### Core Functionality
- ![Home Page](../Product Screenshots/Home Page.png) - Main dashboard with extraction results
- ![Run Comparison](../Product Screenshots/Run Comparison.png) - Document processing workflow
- ![Select Documents Form](../Product Screenshots/Select Documents Form.png) - File selection interface
- ![Files added to Grid with Metadata Fields](../Product Screenshots/Files added to Grid with Metadata Fields.png) - Results display

### Template Management
- ![View Templates](../Product Screenshots/View Templates.png) - Template listing
- ![Add new template from Box](../Product Screenshots/Add new template from Box.png) - Template creation

### Ground Truth Management
- ![Ground Truth Page - List Files from Box](../Product Screenshots/Grount Truth Page - List Files from Box.png) - Ground truth interface
- ![Edit Ground Truth](../Product Screenshots/Edit Ground Truth.png) - Ground truth editing

### Prompt Engineering
- ![Generate a new prompt](../Product Screenshots/Geneate a new prompt.png) - Prompt generation
- ![Edit Prompt](../Product Screenshots/Edit Prompt.png) - Prompt editing interface

### Settings & Configuration
- ![Settings - Developer Token](../Product Screenshots/Settings - Developer Token.png) - Developer token configuration
- ![Setting - Service Account](../Product Screenshots/Setting - Service Account.png) - Service account setup

### Analytics & Metrics
- ![View Metrics - F1 Score](../Product Screenshots/View Metrics - F1 Score.png) - Performance metrics display
- ![Select Models to run](../Product Screenshots/Select Models to run.png) - Model selection interface 
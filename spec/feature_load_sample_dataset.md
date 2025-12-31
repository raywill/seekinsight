
# Feature Specification: Load Sample Dataset

## 1. Overview
Allow users to quickly populate an empty notebook with high-quality, pre-defined datasets (e.g., E-commerce, HR, Movies) to facilitate immediate exploration and testing of platform capabilities without needing manual file uploads.

## 2. Technical Architecture (Strategy C: Master Clone)
- **Master Database**: A hidden database named `seekinsight_datasets` is initialized on server start.
- **Initialization**: 
  - The backend reads `.sql` files from a new `datasets/` directory.
  - It executes these files against `seekinsight_datasets` to ensure the master data exists.
- **Cloning Logic**:
  - When a user selects a dataset, the backend performs a server-side copy:
    1. `CREATE TABLE target_db.table LIKE seekinsight_datasets.table` (Copy Schema)
    2. `INSERT INTO target_db.table SELECT * FROM seekinsight_datasets.table` (Copy Data)
  - This is significantly faster than parsing insert statements for every user request.

## 3. User Interface

### A. Empty State in Sidebar
- **Condition**: Only visible when `tables.length === 0`.
- **Component**: `EmptyStatePanel` inside `DataSidebar`.
- **Elements**:
  - Existing "Upload File" button.
  - **New "Load Sample Dataset" button**: Styled prominently (e.g., ghost blue or outlined).

### B. Dataset Picker Modal
- **Title**: "Start with a Sample Dataset".
- **Layout**: Grid of cards (2x2 or 1x3).
- **Card Content**:
  - Icon (Lucide React).
  - Title (e.g., "E-commerce Sales").
  - Description (e.g., "Orders, Products, Customers").
  - Row count badge.
- **Action**: Clicking "Import" triggers a loading state ("Cloning dataset...").

## 4. Backend API

### `GET /datasets`
- Returns metadata of available datasets (id, name, description, icon key).

### `POST /datasets/import`
- **Body**: `{ dbName: string, datasetId: string }`.
- **Behavior**: Executes the cloning SQL commands.
- **Side Effect**: Can trigger a topic rename suggestion if the frontend requests it.

## 5. Data Assets
1. **Retail / E-commerce**: `orders`, `products` (Sales trends).
2. **HR / Workforce**: `employees`, `departments` (Demographics).
3. **Movies**: `movies`, `reviews` (Text analysis).

import type { ScriptTemplate } from "./types";

export const SCRIPT_TEMPLATES: ScriptTemplate[] = [
  // Data Analysis Templates
  {
    id: "basic_data_exploration",
    name: "Basic Data Exploration",
    description: "Load data from DuckDB and perform basic exploration",
    category: "data_analysis",
    tags: ["pandas", "exploration", "duckdb"],
    code: `# Load data from DuckDB table
import pandas as pd
import numpy as np

# Replace 'your_table' with an actual table name
# You can see available tables in the left panel
df = pd.read_sql("SELECT * FROM your_table LIMIT 1000", connection)

# Basic information about the dataset
print("Dataset shape:", df.shape)
print("\\nColumn information:")
print(df.info())

print("\\nFirst few rows:")
display(df.head())

print("\\nBasic statistics:")
display(df.describe())

print("\\nMissing values:")
print(df.isnull().sum())`,
    requiredPackages: ["pandas", "numpy"]
  },

  {
    id: "duckdb_to_pandas",
    name: "DuckDB to Pandas",
    description: "Execute SQL queries and work with results in pandas",
    category: "data_analysis", 
    tags: ["duckdb", "pandas", "sql"],
    code: `# Execute SQL query and get results as DataFrame
sql_query = """
SELECT * 
FROM your_table 
WHERE column_name > 100
ORDER BY another_column
LIMIT 500
"""

# Execute query through DuckDB bridge
df = query_to_pandas(sql_query)

print(f"Query returned {len(df)} rows")
print("\\nColumns:", df.columns.tolist())
print("\\nData types:")
print(df.dtypes)

# Now you can use pandas operations
df_summary = df.groupby('category_column').agg({
    'numeric_column': ['mean', 'sum', 'count']
}).round(2)

print("\\nGrouped summary:")
display(df_summary)`,
    requiredPackages: ["pandas"]
  },

  {
    id: "pandas_to_duckdb", 
    name: "Pandas to DuckDB",
    description: "Create DataFrames in Python and save to DuckDB tables",
    category: "data_analysis",
    tags: ["pandas", "duckdb", "data-export"],
    code: `# Create a sample DataFrame
import pandas as pd
import numpy as np

# Generate sample data
np.random.seed(42)
df = pd.DataFrame({
    'id': range(1, 101),
    'name': [f'Item_{i}' for i in range(1, 101)],
    'category': np.random.choice(['A', 'B', 'C'], 100),
    'value': np.random.normal(100, 20, 100).round(2),
    'date': pd.date_range('2024-01-01', periods=100, freq='D')
})

print("Created DataFrame:")
display(df.head(10))

# Save to DuckDB table
table_name = "python_generated_data"
pandas_to_table(df, table_name)

print(f"\\nDataFrame saved to DuckDB table: {table_name}")
print("You can now query it with SQL in the Query tab!")`,
    requiredPackages: ["pandas", "numpy"]
  },

  // Visualization Templates
  {
    id: "basic_plotting",
    name: "Basic Data Visualization",
    description: "Create common plots with matplotlib",
    category: "visualization",
    tags: ["matplotlib", "plotting", "visualization"], 
    code: `import matplotlib.pyplot as plt
import numpy as np
import pandas as pd

# Load some data first
df = pd.read_sql("SELECT * FROM your_table LIMIT 1000", connection)

# Create figure with subplots
fig, axes = plt.subplots(2, 2, figsize=(12, 10))
fig.suptitle('Data Analysis Dashboard', fontsize=16)

# 1. Histogram
axes[0, 0].hist(df['numeric_column'], bins=30, alpha=0.7, color='skyblue')
axes[0, 0].set_title('Distribution of Values')
axes[0, 0].set_xlabel('Value')
axes[0, 0].set_ylabel('Frequency')

# 2. Bar plot (top categories)
category_counts = df['category_column'].value_counts().head(10)
axes[0, 1].bar(category_counts.index, category_counts.values, color='lightcoral')
axes[0, 1].set_title('Top Categories')
axes[0, 1].tick_params(axis='x', rotation=45)

# 3. Line plot (if you have time series data)
if 'date_column' in df.columns:
    daily_counts = df.groupby('date_column').size()
    axes[1, 0].plot(daily_counts.index, daily_counts.values, marker='o')
    axes[1, 0].set_title('Trend Over Time')
    axes[1, 0].tick_params(axis='x', rotation=45)

# 4. Scatter plot
axes[1, 1].scatter(df['x_column'], df['y_column'], alpha=0.6, color='green')
axes[1, 1].set_title('Correlation Plot')
axes[1, 1].set_xlabel('X Variable')
axes[1, 1].set_ylabel('Y Variable')

plt.tight_layout()
plt.show()`,
    requiredPackages: ["matplotlib", "pandas", "numpy"]
  },

  {
    id: "seaborn_advanced",
    name: "Advanced Plots with Seaborn",
    description: "Create publication-ready plots with seaborn",
    category: "visualization",
    tags: ["seaborn", "statistical-plots", "advanced"],
    code: `import seaborn as sns
import matplotlib.pyplot as plt
import pandas as pd

# Set seaborn style
sns.set_style("whitegrid")
plt.rcParams['figure.figsize'] = (12, 8)

# Load your data
df = pd.read_sql("SELECT * FROM your_table LIMIT 1000", connection)

# Create a comprehensive analysis plot
fig, axes = plt.subplots(2, 3, figsize=(18, 12))
fig.suptitle('Advanced Data Analysis with Seaborn', fontsize=16)

# 1. Distribution plot with KDE
sns.histplot(data=df, x='numeric_column', kde=True, ax=axes[0, 0])
axes[0, 0].set_title('Distribution with KDE')

# 2. Box plot by category
sns.boxplot(data=df, x='category_column', y='numeric_column', ax=axes[0, 1])
axes[0, 1].set_title('Box Plot by Category')
axes[0, 1].tick_params(axis='x', rotation=45)

# 3. Correlation heatmap
numeric_cols = df.select_dtypes(include=[np.number]).columns
corr_matrix = df[numeric_cols].corr()
sns.heatmap(corr_matrix, annot=True, cmap='coolwarm', center=0, ax=axes[0, 2])
axes[0, 2].set_title('Correlation Matrix')

# 4. Violin plot
sns.violinplot(data=df, x='category_column', y='numeric_column', ax=axes[1, 0])
axes[1, 0].set_title('Violin Plot')
axes[1, 0].tick_params(axis='x', rotation=45)

# 5. Pairplot (subset of columns)
if len(numeric_cols) >= 2:
    # Create separate figure for pairplot
    plt.figure(figsize=(10, 8))
    sns.pairplot(df[numeric_cols[:4]], diag_kind='kde')
    plt.suptitle('Pairwise Relationships', y=1.02)
    plt.show()

# 6. Count plot
sns.countplot(data=df, x='category_column', ax=axes[1, 1])
axes[1, 1].set_title('Category Counts')
axes[1, 1].tick_params(axis='x', rotation=45)

# 7. Regression plot
if len(numeric_cols) >= 2:
    sns.regplot(data=df, x=numeric_cols[0], y=numeric_cols[1], ax=axes[1, 2])
    axes[1, 2].set_title('Regression Plot')

plt.tight_layout()
plt.show()`,
    requiredPackages: ["seaborn", "matplotlib", "pandas", "numpy"]
  },

  // Machine Learning Templates
  {
    id: "basic_ml_analysis",
    name: "Basic Machine Learning",
    description: "Simple ML analysis with scikit-learn",
    category: "ml",
    tags: ["scikit-learn", "machine-learning", "classification"],
    code: `# Note: scikit-learn needs to be installed first
# Run: await micropip.install('scikit-learn')

import pandas as pd
import numpy as np
from sklearn.model_selection import train_test_split
from sklearn.ensemble import RandomForestClassifier
from sklearn.metrics import classification_report, confusion_matrix
from sklearn.preprocessing import LabelEncoder
import matplotlib.pyplot as plt

# Load data
df = pd.read_sql("SELECT * FROM your_table LIMIT 1000", connection)

# Prepare data for ML
# Select features (numeric columns)
numeric_cols = df.select_dtypes(include=[np.number]).columns.tolist()
categorical_cols = df.select_dtypes(include=['object']).columns.tolist()

print(f"Numeric columns: {numeric_cols}")
print(f"Categorical columns: {categorical_cols}")

# Assume the first categorical column is the target
if categorical_cols:
    target_col = categorical_cols[0]
    feature_cols = numeric_cols
    
    # Prepare features and target
    X = df[feature_cols].fillna(0)  # Handle missing values
    y = df[target_col].fillna('unknown')
    
    # Encode target if it's categorical
    le = LabelEncoder()
    y_encoded = le.fit_transform(y)
    
    # Split the data
    X_train, X_test, y_train, y_test = train_test_split(
        X, y_encoded, test_size=0.2, random_state=42
    )
    
    # Train model
    rf = RandomForestClassifier(n_estimators=100, random_state=42)
    rf.fit(X_train, y_train)
    
    # Make predictions
    y_pred = rf.predict(X_test)
    
    # Results
    print("\\nClassification Report:")
    print(classification_report(y_test, y_pred, target_names=le.classes_))
    
    # Feature importance
    feature_importance = pd.DataFrame({
        'feature': feature_cols,
        'importance': rf.feature_importances_
    }).sort_values('importance', ascending=False)
    
    print("\\nFeature Importance:")
    print(feature_importance)
    
    # Plot feature importance
    plt.figure(figsize=(10, 6))
    plt.barh(feature_importance['feature'], feature_importance['importance'])
    plt.title('Feature Importance')
    plt.xlabel('Importance')
    plt.tight_layout()
    plt.show()
    
else:
    print("No categorical columns found for classification task")`,
    requiredPackages: ["pandas", "numpy", "matplotlib"]
  },

  // Statistical Analysis Templates
  {
    id: "statistical_analysis",
    name: "Statistical Analysis",
    description: "Perform statistical tests and analysis",
    category: "stats",
    tags: ["statistics", "scipy", "analysis"],
    code: `import pandas as pd
import numpy as np
import matplotlib.pyplot as plt
from scipy import stats

# Load your data
df = pd.read_sql("SELECT * FROM your_table LIMIT 1000", connection)

print("Statistical Analysis Report")
print("=" * 50)

# Basic descriptive statistics
numeric_cols = df.select_dtypes(include=[np.number]).columns
print(f"\\nAnalyzing {len(numeric_cols)} numeric columns")

for col in numeric_cols:
    data = df[col].dropna()
    
    print(f"\\n{col.upper()}:")
    print(f"  Mean: {data.mean():.2f}")
    print(f"  Median: {data.median():.2f}")
    print(f"  Std Dev: {data.std():.2f}")
    print(f"  Skewness: {stats.skew(data):.2f}")
    print(f"  Kurtosis: {stats.kurtosis(data):.2f}")
    
    # Normality test
    if len(data) > 3:
        stat, p_value = stats.shapiro(data[:5000])  # Limit for Shapiro-Wilk
        print(f"  Normality test p-value: {p_value:.4f}")
        print(f"  Normal distribution: {'Yes' if p_value > 0.05 else 'No'}")

# Correlation analysis
if len(numeric_cols) > 1:
    print("\\nCorrelation Analysis:")
    corr_matrix = df[numeric_cols].corr()
    
    # Find strongest correlations
    corr_pairs = []
    for i in range(len(corr_matrix)):
        for j in range(i+1, len(corr_matrix)):
            corr_pairs.append({
                'var1': corr_matrix.index[i],
                'var2': corr_matrix.columns[j], 
                'correlation': corr_matrix.iloc[i, j]
            })
    
    corr_df = pd.DataFrame(corr_pairs)
    corr_df = corr_df.reindex(corr_df['correlation'].abs().sort_values(ascending=False).index)
    
    print("Strongest correlations:")
    for _, row in corr_df.head(5).iterrows():
        print(f"  {row['var1']} <-> {row['var2']}: {row['correlation']:.3f}")

# Group analysis (if categorical columns exist)
categorical_cols = df.select_dtypes(include=['object']).columns
if len(categorical_cols) > 0 and len(numeric_cols) > 0:
    cat_col = categorical_cols[0]
    num_col = numeric_cols[0]
    
    print(f"\\nGroup Analysis: {num_col} by {cat_col}")
    groups = [group[num_col].dropna() for name, group in df.groupby(cat_col)]
    
    if len(groups) > 1:
        # ANOVA test
        f_stat, p_value = stats.f_oneway(*groups)
        print(f"  ANOVA F-statistic: {f_stat:.3f}")
        print(f"  ANOVA p-value: {p_value:.4f}")
        print(f"  Significant difference: {'Yes' if p_value < 0.05 else 'No'}")
        
        # Group statistics
        group_stats = df.groupby(cat_col)[num_col].agg(['mean', 'std', 'count'])
        print("\\nGroup Statistics:")
        print(group_stats.round(2))

print("\\nAnalysis complete!")`,
    requiredPackages: ["pandas", "numpy", "matplotlib", "scipy"]
  },

  // Utility Templates
  {
    id: "data_cleaning",
    name: "Data Cleaning Utilities",
    description: "Common data cleaning and preprocessing operations",
    category: "utils",
    tags: ["data-cleaning", "preprocessing", "utilities"],
    code: `import pandas as pd
import numpy as np

# Load your data
df = pd.read_sql("SELECT * FROM your_table", connection)

print("Data Cleaning Report")
print("=" * 40)
print(f"Original dataset shape: {df.shape}")

# 1. Check for missing values
print("\\n1. Missing Values Analysis:")
missing_data = df.isnull().sum()
missing_percent = (missing_data / len(df)) * 100
missing_df = pd.DataFrame({
    'Column': missing_data.index,
    'Missing Count': missing_data.values,
    'Missing %': missing_percent.values
}).sort_values('Missing %', ascending=False)

print(missing_df[missing_df['Missing Count'] > 0])

# 2. Handle duplicates
print("\\n2. Duplicate Analysis:")
duplicates = df.duplicated().sum()
print(f"Number of duplicate rows: {duplicates}")

if duplicates > 0:
    df_cleaned = df.drop_duplicates()
    print(f"Dataset shape after removing duplicates: {df_cleaned.shape}")
else:
    df_cleaned = df.copy()

# 3. Data type optimization
print("\\n3. Data Type Optimization:")
print("Current data types:")
print(df_cleaned.dtypes)

# Convert string columns that might be categorical
for col in df_cleaned.select_dtypes(include=['object']).columns:
    unique_ratio = df_cleaned[col].nunique() / len(df_cleaned)
    if unique_ratio < 0.5:  # If less than 50% unique values, convert to category
        df_cleaned[col] = df_cleaned[col].astype('category')
        print(f"Converted {col} to category (unique ratio: {unique_ratio:.2f})")

# 4. Outlier detection (for numeric columns)
print("\\n4. Outlier Detection (IQR method):")
numeric_cols = df_cleaned.select_dtypes(include=[np.number]).columns

outlier_summary = []
for col in numeric_cols:
    Q1 = df_cleaned[col].quantile(0.25)
    Q3 = df_cleaned[col].quantile(0.75)
    IQR = Q3 - Q1
    
    lower_bound = Q1 - 1.5 * IQR
    upper_bound = Q3 + 1.5 * IQR
    
    outliers = df_cleaned[(df_cleaned[col] < lower_bound) | (df_cleaned[col] > upper_bound)]
    outlier_count = len(outliers)
    outlier_percent = (outlier_count / len(df_cleaned)) * 100
    
    outlier_summary.append({
        'Column': col,
        'Outliers': outlier_count,
        'Outlier %': outlier_percent,
        'Lower Bound': lower_bound,
        'Upper Bound': upper_bound
    })

outlier_df = pd.DataFrame(outlier_summary)
print(outlier_df.round(2))

# 5. Missing value imputation options
print("\\n5. Missing Value Imputation Suggestions:")
for col in df_cleaned.columns:
    missing_pct = (df_cleaned[col].isnull().sum() / len(df_cleaned)) * 100
    
    if missing_pct > 0:
        if df_cleaned[col].dtype in ['int64', 'float64']:
            mean_val = df_cleaned[col].mean()
            median_val = df_cleaned[col].median()
            print(f"{col}: Mean={mean_val:.2f}, Median={median_val:.2f}")
        elif df_cleaned[col].dtype == 'object':
            mode_val = df_cleaned[col].mode().iloc[0] if not df_cleaned[col].mode().empty else 'N/A'
            print(f"{col}: Mode='{mode_val}'")

# 6. Create cleaned dataset
print("\\n6. Cleaning Summary:")
print(f"Original shape: {df.shape}")
print(f"After cleaning: {df_cleaned.shape}")
print(f"Rows removed: {df.shape[0] - df_cleaned.shape[0]}")

# Optional: Save cleaned data back to DuckDB
# pandas_to_table(df_cleaned, "cleaned_data")
# print("\\nCleaned data saved as 'cleaned_data' table")`,
    requiredPackages: ["pandas", "numpy"]
  },

  {
    id: "export_utilities", 
    name: "Data Export Utilities",
    description: "Export data to various formats and create summaries",
    category: "utils",
    tags: ["export", "csv", "json", "utilities"],
    code: `import pandas as pd
import json
from datetime import datetime

# Load your data
df = pd.read_sql("SELECT * FROM your_table LIMIT 1000", connection)

print("Data Export Utilities")
print("=" * 30)

# 1. Create data summary report
def create_data_summary(df):
    summary = {
        'dataset_info': {
            'shape': df.shape,
            'columns': df.columns.tolist(),
            'memory_usage': f"{df.memory_usage(deep=True).sum() / 1024**2:.2f} MB",
            'export_timestamp': datetime.now().isoformat()
        },
        'column_analysis': {}
    }
    
    for col in df.columns:
        col_info = {
            'dtype': str(df[col].dtype),
            'non_null_count': int(df[col].count()),
            'null_count': int(df[col].isnull().sum()),
            'unique_values': int(df[col].nunique())
        }
        
        if df[col].dtype in ['int64', 'float64']:
            col_info.update({
                'mean': float(df[col].mean()) if not pd.isna(df[col].mean()) else None,
                'std': float(df[col].std()) if not pd.isna(df[col].std()) else None,
                'min': float(df[col].min()) if not pd.isna(df[col].min()) else None,
                'max': float(df[col].max()) if not pd.isna(df[col].max()) else None,
                'median': float(df[col].median()) if not pd.isna(df[col].median()) else None
            })
        elif df[col].dtype == 'object':
            try:
                top_values = df[col].value_counts().head(5).to_dict()
                col_info['top_values'] = {str(k): int(v) for k, v in top_values.items()}
            except:
                col_info['top_values'] = {}
        
        summary['column_analysis'][col] = col_info
    
    return summary

# Generate summary
summary = create_data_summary(df)
print(f"Summary created for dataset with {summary['dataset_info']['shape'][0]} rows and {summary['dataset_info']['shape'][1]} columns")

# 2. Export options

# Option A: Export as JSON (for small datasets)
print("\\nExport Options:")
print("1. JSON Summary (copy the output below):")
print("-" * 40)
print(json.dumps(summary, indent=2))

# Option B: Create downloadable CSV data (first 1000 rows)
sample_data = df.head(1000)
csv_data = sample_data.to_csv(index=False)
print(f"\\n2. CSV Data Preview (first 100 chars):")
print(csv_data[:100] + "...")

# Option C: Generate code to recreate the dataset
print("\\n3. Python code to recreate dataset:")
print("-" * 40)
print("import pandas as pd")
print("import numpy as np")
print()

# Generate sample data creation code
for col in df.columns[:5]:  # Limit to first 5 columns
    if df[col].dtype in ['int64', 'float64']:
        print(f"# {col}: numeric column")
        print(f"# Range: {df[col].min():.2f} to {df[col].max():.2f}")
    elif df[col].dtype == 'object':
        unique_vals = df[col].unique()[:5]
        print(f"# {col}: categorical column")
        print(f"# Sample values: {list(unique_vals)}")

print()
print("# Recreate similar dataset structure:")
print("sample_df = pd.DataFrame({")
for i, col in enumerate(df.columns[:3]):
    if df[col].dtype in ['int64', 'float64']:
        print(f"    '{col}': np.random.normal({df[col].mean():.2f}, {df[col].std():.2f}, 100),")
    else:
        unique_vals = df[col].dropna().unique()[:3]
        print(f"    '{col}': np.random.choice({list(unique_vals)}, 100),")
print("})")

# 4. Data quality report
print("\\n4. Data Quality Report:")
print("-" * 25)
quality_score = 0
total_checks = 0

# Check 1: Missing data
missing_pct = (df.isnull().sum().sum() / (df.shape[0] * df.shape[1])) * 100
if missing_pct < 5:
    quality_score += 1
total_checks += 1
print(f"Missing data: {missing_pct:.1f}% {'✓' if missing_pct < 5 else '⚠'}")

# Check 2: Duplicate rows
dup_pct = (df.duplicated().sum() / len(df)) * 100
if dup_pct < 1:
    quality_score += 1
total_checks += 1
print(f"Duplicate rows: {dup_pct:.1f}% {'✓' if dup_pct < 1 else '⚠'}")

# Check 3: Data types consistency
consistent_types = all(df[col].dtype != 'object' or df[col].nunique() / len(df) < 0.8 for col in df.columns)
if consistent_types:
    quality_score += 1
total_checks += 1
print(f"Data type consistency: {'✓' if consistent_types else '⚠'}")

print(f"\\nOverall Quality Score: {quality_score}/{total_checks} ({(quality_score/total_checks)*100:.0f}%)")

print("\\nExport complete! Use the outputs above as needed.")`,
    requiredPackages: ["pandas", "numpy"]
  }
];

/**
 * Get templates by category
 */
export function getTemplatesByCategory(category: ScriptTemplate['category']): ScriptTemplate[] {
  return SCRIPT_TEMPLATES.filter(template => template.category === category);
}

/**
 * Search templates by query
 */
export function searchTemplates(query: string): ScriptTemplate[] {
  const searchTerm = query.toLowerCase();
  return SCRIPT_TEMPLATES.filter(template => 
    template.name.toLowerCase().includes(searchTerm) ||
    template.description.toLowerCase().includes(searchTerm) ||
    template.tags.some(tag => tag.toLowerCase().includes(searchTerm))
  );
}

/**
 * Get template by ID
 */
export function getTemplateById(id: string): ScriptTemplate | undefined {
  return SCRIPT_TEMPLATES.find(template => template.id === id);
}
import type { ScriptTemplate } from "./types";

export const SCRIPT_TEMPLATES: ScriptTemplate[] = [
  // Quick Start Template
  {
    id: "sample_employees_analysis",
    name: "Sample Employees Analysis",
    description: "Get started quickly with the built-in employees sample table",
    category: "data_analysis",
    tags: ["quickstart", "duckdb"],
    code: `# Working with the sample employees table
import pandas as pd
import matplotlib.pyplot as plt

# Query the sample employees table using the sql() function
df = await sql("SELECT * FROM employees_sample")

print("Sample Employees Data:")
print(df)
print(f"\\nTotal employees: {len(df)}")

# Group by department and calculate average salary
dept_summary = await sql("""
    SELECT 
        department,
        COUNT(*) as employee_count,
        AVG(salary) as avg_salary,
        MIN(salary) as min_salary,
        MAX(salary) as max_salary
    FROM employees_sample
    GROUP BY department
    ORDER BY avg_salary DESC
""")

print("\\nDepartment Summary:")
print(dept_summary)

# Create a bar chart of average salaries by department
plt.figure(figsize=(10, 6))
bars = plt.bar(dept_summary['department'], dept_summary['avg_salary'], color=['#1f77b4', '#ff7f0e', '#2ca02c'])

# Add value labels on bars
for bar in bars:
    height = bar.get_height()
    plt.text(bar.get_x() + bar.get_width()/2., height,
             '$' + f'{height:,.0f}', ha='center', va='bottom')

plt.xlabel('Department')
plt.ylabel('Average Salary ($)')
plt.title('Average Salary by Department')
plt.xticks(rotation=45)
plt.tight_layout()
plt.show()

# You can also use query() or sql_bridge.query_to_pandas() for more explicit calls
# employees_hr = await query("SELECT * FROM employees_sample WHERE department = 'HR'")`,
    requiredPackages: ["pandas", "matplotlib"]
  },

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

# List available tables
print("Available tables:", sql_bridge.get_table_names())

# Load the sample employees table
df = await sql("SELECT * FROM employees_sample")

# Basic information about the dataset
print("\\nDataset shape:", df.shape)
print("\\nColumn information:")
print(df.info())

print("\\nFirst few rows:")
df.head()

print("\\nBasic statistics:")
df.describe()

print("\\nMissing values:")
print(df.isnull().sum())

# Group by department
dept_counts = df['department'].value_counts()
print("\\nEmployees per department:")
print(dept_counts)`,
    requiredPackages: ["pandas", "numpy"]
  },

  {
    id: "duckdb_to_pandas",
    name: "DuckDB to Pandas",
    description: "Execute SQL queries and work with results in pandas",
    category: "data_analysis", 
    tags: ["duckdb", "pandas", "sql"],
    code: `# Execute SQL query and get results as DataFrame
# Example 1: Filter employees by salary
high_earners = await sql("""
SELECT * 
FROM employees_sample 
WHERE salary > 70000
ORDER BY salary DESC
""")

print(f"High earners: {len(high_earners)} employees")
print(high_earners)

# Example 2: Aggregate query with grouping
dept_stats = await sql("""
SELECT 
    department,
    COUNT(*) as employee_count,
    AVG(salary) as avg_salary,
    MIN(salary) as min_salary,
    MAX(salary) as max_salary,
    SUM(salary) as total_salary
FROM employees_sample
GROUP BY department
ORDER BY avg_salary DESC
""")

print("\\nDepartment Statistics:")
print(dept_stats)

# Example 3: Using CTEs (Common Table Expressions)
salary_analysis = await sql("""
WITH salary_categories AS (
    SELECT 
        *,
        CASE 
            WHEN salary < 60000 THEN 'Junior'
            WHEN salary BETWEEN 60000 AND 80000 THEN 'Mid-level'
            ELSE 'Senior'
        END as level
    FROM employees_sample
)
SELECT 
    level,
    COUNT(*) as count,
    AVG(salary) as avg_salary
FROM salary_categories
GROUP BY level
ORDER BY avg_salary
""")

print("\\nSalary Level Analysis:")
print(salary_analysis)`,
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

# First, let's analyze the existing employees data
employees = await sql("SELECT * FROM employees_sample")

# Create a performance review DataFrame based on employees
np.random.seed(42)
performance_reviews = pd.DataFrame({
    'employee_id': employees['id'],
    'employee_name': employees['name'],
    'department': employees['department'],
    'review_score': np.random.normal(3.5, 0.5, len(employees)).round(1).clip(1, 5),
    'projects_completed': np.random.poisson(5, len(employees)),
    'review_date': pd.date_range('2024-01-01', periods=len(employees), freq='D')
})

print("Created Performance Reviews DataFrame:")
print(performance_reviews.head(10))

# Save to DuckDB table
table_name = "performance_reviews"
await sql_bridge.pandas_to_table(performance_reviews, table_name)

print(f"\\nDataFrame saved to DuckDB table: {table_name}")

# Now we can join the tables!
employee_performance = await sql("""
SELECT 
    e.*,
    p.review_score,
    p.projects_completed,
    p.review_date
FROM employees_sample e
JOIN performance_reviews p ON e.id = p.employee_id
WHERE p.review_score >= 4.0
ORDER BY p.review_score DESC
""")

print(f"\\nTop performers (review score >= 4.0): {len(employee_performance)} employees")
print(employee_performance)`,
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

# Load employees data
df = await sql("SELECT * FROM employees_sample")

# Create figure with subplots
fig, axes = plt.subplots(2, 2, figsize=(12, 10))
fig.suptitle('Employee Data Analysis Dashboard', fontsize=16)

# 1. Salary distribution histogram
axes[0, 0].hist(df['salary'], bins=15, alpha=0.7, color='skyblue', edgecolor='black')
axes[0, 0].set_title('Salary Distribution')
axes[0, 0].set_xlabel('Salary ($)')
axes[0, 0].set_ylabel('Number of Employees')
axes[0, 0].axvline(df['salary'].mean(), color='red', linestyle='--', label=f'Mean: $' + f'{df["salary"].mean():,.0f}')
axes[0, 0].legend()

# 2. Department bar plot
dept_counts = df['department'].value_counts()
bars = axes[0, 1].bar(dept_counts.index, dept_counts.values, color=['#1f77b4', '#ff7f0e', '#2ca02c'])
axes[0, 1].set_title('Employees by Department')
axes[0, 1].set_xlabel('Department')
axes[0, 1].set_ylabel('Count')
for bar in bars:
    height = bar.get_height()
    axes[0, 1].text(bar.get_x() + bar.get_width()/2., height,
                    f'{int(height)}', ha='center', va='bottom')

# 3. Salary by department box plot
departments = df['department'].unique()
salary_data = [df[df['department'] == dept]['salary'].values for dept in departments]
axes[1, 0].boxplot(salary_data, labels=departments)
axes[1, 0].set_title('Salary Distribution by Department')
axes[1, 0].set_xlabel('Department')
axes[1, 0].set_ylabel('Salary ($)')

# 4. ID vs Salary scatter plot (to show any patterns)
axes[1, 1].scatter(df['id'], df['salary'], alpha=0.6, c=df['department'].astype('category').cat.codes, cmap='viridis')
axes[1, 1].set_title('Employee ID vs Salary (colored by department)')
axes[1, 1].set_xlabel('Employee ID')
axes[1, 1].set_ylabel('Salary ($)')

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
import numpy as np

# Set seaborn style
sns.set_style("whitegrid")
plt.rcParams['figure.figsize'] = (12, 8)

# Load employees data
df = await sql("SELECT * FROM employees_sample")

# Create a comprehensive analysis plot
fig, axes = plt.subplots(2, 3, figsize=(18, 12))
fig.suptitle('Employee Data Analysis with Seaborn', fontsize=16)

# 1. Salary distribution with KDE
sns.histplot(data=df, x='salary', kde=True, ax=axes[0, 0], color='skyblue')
axes[0, 0].set_title('Salary Distribution with KDE')
axes[0, 0].set_xlabel('Salary ($)')

# 2. Box plot by department
sns.boxplot(data=df, x='department', y='salary', ax=axes[0, 1], palette='Set2')
axes[0, 1].set_title('Salary Box Plot by Department')
axes[0, 1].set_xlabel('Department')
axes[0, 1].set_ylabel('Salary ($)')

# 3. Create a correlation matrix with additional metrics
# Add some calculated fields for correlation
df['salary_rank'] = df['salary'].rank()
df['id_group'] = pd.cut(df['id'], bins=5, labels=['1-20', '21-40', '41-60', '61-80', '81-100'])
numeric_cols = ['id', 'salary', 'salary_rank']
corr_matrix = df[numeric_cols].corr()
sns.heatmap(corr_matrix, annot=True, cmap='coolwarm', center=0, ax=axes[0, 2])
axes[0, 2].set_title('Correlation Matrix')

# 4. Violin plot
sns.violinplot(data=df, x='department', y='salary', ax=axes[1, 0], palette='muted')
axes[1, 0].set_title('Salary Distribution (Violin Plot)')
axes[1, 0].set_xlabel('Department')
axes[1, 0].set_ylabel('Salary ($)')

# 5. Count plot for departments
sns.countplot(data=df, x='department', ax=axes[1, 1], palette='pastel')
axes[1, 1].set_title('Employee Count by Department')
axes[1, 1].set_xlabel('Department')
axes[1, 1].set_ylabel('Count')

# Add value labels on bars
for container in axes[1, 1].containers:
    axes[1, 1].bar_label(container)

# 6. Swarm plot for detailed view
sns.swarmplot(data=df, x='department', y='salary', ax=axes[1, 2], alpha=0.7)
axes[1, 2].set_title('Individual Salaries by Department')
axes[1, 2].set_xlabel('Department')
axes[1, 2].set_ylabel('Salary ($)')

plt.tight_layout()
plt.show()

# Create a separate pairplot for salary analysis
plt.figure(figsize=(10, 8))
# Add some derived features for better visualization
df['salary_percentile'] = df['salary'].rank(pct=True) * 100
pairplot_df = df[['salary', 'salary_percentile', 'department']].copy()
sns.pairplot(pairplot_df, hue='department', diag_kind='kde', palette='Set1')
plt.suptitle('Salary Analysis Pairplot', y=1.02)
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
# Run: import micropip; await micropip.install('scikit-learn')

import pandas as pd
import numpy as np
from sklearn.model_selection import train_test_split
from sklearn.ensemble import RandomForestClassifier
from sklearn.linear_model import LinearRegression
from sklearn.metrics import classification_report, mean_squared_error, r2_score
from sklearn.preprocessing import LabelEncoder
import matplotlib.pyplot as plt

# Load employee data
df = await sql("SELECT * FROM employees_sample")

print("Employee Dataset:")
print(df.head())
print(f"\\nShape: {df.shape}")

# ML Task 1: Predict department based on salary and ID
print("\\n" + "="*50)
print("CLASSIFICATION: Predicting Department")
print("="*50)

# Features for classification
X_class = df[['id', 'salary']]
y_class = df['department']

# Encode the target
le = LabelEncoder()
y_class_encoded = le.fit_transform(y_class)

# Split the data
X_train, X_test, y_train, y_test = train_test_split(
    X_class, y_class_encoded, test_size=0.3, random_state=42
)

# Train Random Forest classifier
rf = RandomForestClassifier(n_estimators=50, random_state=42)
rf.fit(X_train, y_train)

# Make predictions
y_pred = rf.predict(X_test)

# Results
print("\\nClassification Results:")
print(classification_report(y_test, y_pred, target_names=le.classes_))

# Feature importance
feature_importance = pd.DataFrame({
    'feature': ['Employee ID', 'Salary'],
    'importance': rf.feature_importances_
}).sort_values('importance', ascending=False)

print("\\nFeature Importance for Department Prediction:")
print(feature_importance)

# ML Task 2: Predict salary based on ID (regression)
print("\\n" + "="*50)
print("REGRESSION: Predicting Salary from Employee ID")
print("="*50)

# Features for regression
X_reg = df[['id']].values
y_reg = df['salary'].values

# Split the data
X_train_reg, X_test_reg, y_train_reg, y_test_reg = train_test_split(
    X_reg, y_reg, test_size=0.3, random_state=42
)

# Train Linear Regression
lr = LinearRegression()
lr.fit(X_train_reg, y_train_reg)

# Make predictions
y_pred_reg = lr.predict(X_test_reg)

# Results
mse = mean_squared_error(y_test_reg, y_pred_reg)
r2 = r2_score(y_test_reg, y_pred_reg)

print(f"Mean Squared Error: {mse:.2f}")
print(f"R² Score: {r2:.4f}")

# Visualization
fig, axes = plt.subplots(1, 2, figsize=(15, 6))

# Plot 1: Feature importance
axes[0].barh(feature_importance['feature'], feature_importance['importance'])
axes[0].set_title('Feature Importance for Department Prediction')
axes[0].set_xlabel('Importance')

# Plot 2: Regression results
axes[1].scatter(y_test_reg, y_pred_reg, alpha=0.7)
axes[1].plot([y_test_reg.min(), y_test_reg.max()], [y_test_reg.min(), y_test_reg.max()], 'r--', lw=2)
axes[1].set_xlabel('Actual Salary')
axes[1].set_ylabel('Predicted Salary')
axes[1].set_title(f'Salary Prediction (R² = {r2:.4f})')

plt.tight_layout()
plt.show()`,
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

# Load employee data
df = await sql("SELECT * FROM employees_sample")

print("Employee Statistical Analysis Report")
print("=" * 50)

# Basic descriptive statistics for salary
salary_data = df['salary'].dropna()

print("\\nSALARY ANALYSIS:")
print(f"  Mean: $" + f"{salary_data.mean():,.2f}")
print(f"  Median: $" + f"{salary_data.median():,.2f}")
print(f"  Std Dev: $" + f"{salary_data.std():,.2f}")
print(f"  Min: $" + f"{salary_data.min():,.2f}")
print(f"  Max: $" + f"{salary_data.max():,.2f}")
print(f"  Skewness: {stats.skew(salary_data):.2f}")
print(f"  Kurtosis: {stats.kurtosis(salary_data):.2f}")

# Normality test for salary
stat, p_value = stats.shapiro(salary_data)
print(f"  Normality test p-value: {p_value:.4f}")
print(f"  Normal distribution: {'Yes' if p_value > 0.05 else 'No'}")

# Department-wise analysis
print("\\nDEPARTMENT COMPARISON:")
departments = df['department'].unique()

dept_stats = []
for dept in departments:
    dept_salaries = df[df['department'] == dept]['salary']
    dept_stats.append({
        'department': dept,
        'count': len(dept_salaries),
        'mean': dept_salaries.mean(),
        'median': dept_salaries.median(),
        'std': dept_salaries.std()
    })

dept_df = pd.DataFrame(dept_stats).sort_values('mean', ascending=False)
print(dept_df.round(2))

# Statistical tests
print("\\nSTATISTICAL TESTS:")

# 1. ANOVA test for salary differences between departments
dept_groups = [df[df['department'] == dept]['salary'].values for dept in departments]
f_stat, anova_p = stats.f_oneway(*dept_groups)
print(f"\\nANOVA Test (salary differences between departments):")
print(f"  F-statistic: {f_stat:.4f}")
print(f"  p-value: {anova_p:.4f}")
print(f"  Significant difference: {'Yes' if anova_p < 0.05 else 'No'}")

# 2. T-test between highest and lowest paying departments
if len(departments) >= 2:
    high_dept = dept_df.iloc[0]['department']
    low_dept = dept_df.iloc[-1]['department']
    
    high_salaries = df[df['department'] == high_dept]['salary']
    low_salaries = df[df['department'] == low_dept]['salary']
    
    t_stat, t_p = stats.ttest_ind(high_salaries, low_salaries)
    print(f"\\nT-test ({high_dept} vs {low_dept}):")
    print(f"  t-statistic: {t_stat:.4f}")
    print(f"  p-value: {t_p:.4f}")
    print(f"  Significant difference: {'Yes' if t_p < 0.05 else 'No'}")

# 3. Correlation between ID and salary
id_salary_corr, corr_p = stats.pearsonr(df['id'], df['salary'])
print(f"\\nCorrelation (ID vs Salary):")
print(f"  Pearson r: {id_salary_corr:.4f}")
print(f"  p-value: {corr_p:.4f}")
print(f"  Significant correlation: {'Yes' if corr_p < 0.05 else 'No'}")

# Visualization
fig, axes = plt.subplots(2, 2, figsize=(15, 10))

# Salary histogram
axes[0, 0].hist(salary_data, bins=15, alpha=0.7, color='skyblue', edgecolor='black')
axes[0, 0].axvline(salary_data.mean(), color='red', linestyle='--', label=f'Mean: $' + f'{salary_data.mean():,.0f}')
axes[0, 0].set_title('Salary Distribution')
axes[0, 0].set_xlabel('Salary ($)')
axes[0, 0].set_ylabel('Frequency')
axes[0, 0].legend()

# Q-Q plot for normality
stats.probplot(salary_data, dist="norm", plot=axes[0, 1])
axes[0, 1].set_title('Q-Q Plot (Salary Normality)')

# Department comparison
dept_df.plot(x='department', y='mean', kind='bar', ax=axes[1, 0], color='lightcoral')
axes[1, 0].set_title('Average Salary by Department')
axes[1, 0].set_ylabel('Average Salary ($)')
axes[1, 0].tick_params(axis='x', rotation=45)

# ID vs Salary scatter
axes[1, 1].scatter(df['id'], df['salary'], alpha=0.6, c=df['department'].astype('category').cat.codes)
axes[1, 1].set_title(f'ID vs Salary (r = {id_salary_corr:.3f})')
axes[1, 1].set_xlabel('Employee ID')
axes[1, 1].set_ylabel('Salary ($)')

plt.tight_layout()
plt.show()

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
df = await sql("SELECT * FROM employees_sample")

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
df = await sql("SELECT * FROM employees_sample")

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
  },

  // Hugging Face Template 1: Sentiment Analysis with Data Integration
  {
    id: "hf_sentiment_analysis",
    name: "Sentiment Analysis + Data",
    description: "Analyze sentiment of text data from your database using DistilBERT",
    category: "hf",
    tags: ["huggingface", "sentiment", "nlp", "data-analysis"],
    code: `# Sentiment Analysis with Database Integration
# Using Xenova/distilbert-base-uncased-finetuned-sst-2-english

print("🎭 Sentiment Analysis Demo")
print("=" * 40)

# Load the sentiment analysis pipeline
pipeline = transformers.pipeline
sentiment_pipe = await pipeline('sentiment-analysis', 'Xenova/distilbert-base-uncased-finetuned-sst-2-english')

# Sample customer feedback data (you can replace with your own table)
sample_feedback = [
    "The product quality is excellent and delivery was fast!",
    "Terrible customer service, very disappointed.",
    "It's okay, nothing special but does the job.",
    "Amazing experience! Will definitely buy again.",
    "Poor quality, broke after two days of use.",
    "Good value for money, satisfied with purchase.",
    "Outstanding support team, very helpful!",
    "The interface is confusing and hard to navigate."
]

print("\\n📊 Analyzing customer feedback...")
results = []

for i, text in enumerate(sample_feedback, 1):
    result = await sentiment_pipe(text)
    sentiment = result[0]
    
    results.append({
        'id': i,
        'text': text[:50] + "..." if len(text) > 50 else text,
        'sentiment': sentiment['label'],
        'confidence': sentiment['score']
    })
    
    emoji = "😊" if sentiment['label'] == 'POSITIVE' else "😞"
    print(f"{i:2d}. {emoji} {sentiment['label']:<8} ({sentiment['score']:.1%}) | {text[:40]}...")

# Convert to pandas for analysis
import pandas as pd
df = pd.DataFrame(results)

print("\\n📈 Sentiment Summary:")
sentiment_counts = df['sentiment'].value_counts()
print(f"  Positive: {sentiment_counts.get('POSITIVE', 0)} ({sentiment_counts.get('POSITIVE', 0)/len(df)*100:.1f}%)")
print(f"  Negative: {sentiment_counts.get('NEGATIVE', 0)} ({sentiment_counts.get('NEGATIVE', 0)/len(df)*100:.1f}%)")

print(f"\\n🎯 Average Confidence: {df['confidence'].mean():.1%}")
print(f"📝 Total Feedback Analyzed: {len(df)}")

# Display the DataFrame
print("\\n📊 Detailed Results:")
df`,
    requiredPackages: ["transformers-js-py", "pandas"]
  },

  // Hugging Face Template 2: Text Generation Stories
  {
    id: "hf_text_generation",
    name: "AI Story Generator",
    description: "Generate creative stories and text using Llama2.c tiny model",
    category: "hf",
    tags: ["huggingface", "text-generation", "creative", "stories"],
    code: `# AI Story Generator using Llama2.c
# Using Xenova/llama2.c-stories42M - lightweight story generation model

print("📝 AI Story Generator")
print("=" * 35)

# Load text generation pipeline
pipeline = transformers.pipeline
generator = await pipeline('text-generation', 'Xenova/llama2.c-stories42M')

# Story prompts to try
story_prompts = [
    "Once upon a time, in a magical forest,",
    "The old wizard opened his spellbook and",
    "In the year 2150, robots discovered",
    "The detective found a mysterious clue",
    "Deep in the ocean, mermaids were"
]

print("🎨 Generating stories from different prompts...")
print("=" * 50)

generated_stories = []

for i, prompt in enumerate(story_prompts, 1):
    print(f"\\n{i}. 📖 Prompt: '{prompt}'")
    print("   🤖 Generated story:")
    
    # Generate story continuation
    result = await generator(prompt, {
        'max_length': 80,
        'temperature': 0.8,
        'do_sample': True,
        'top_p': 0.9
    })
    
    generated_text = result[0]['generated_text']
    story_continuation = generated_text[len(prompt):].strip()
    
    print(f"   '{prompt} {story_continuation}'")
    
    generated_stories.append({
        'prompt': prompt,
        'full_story': generated_text,
        'continuation': story_continuation,
        'word_count': len(generated_text.split())
    })

# Create analysis of generated content
import pandas as pd
df = pd.DataFrame(generated_stories)

print("\\n\\n📊 Story Generation Analysis:")
print(f"📝 Total stories generated: {len(df)}")
print(f"📏 Average story length: {df['word_count'].mean():.1f} words")
print(f"📈 Longest story: {df['word_count'].max()} words")
print(f"📉 Shortest story: {df['word_count'].min()} words")

print("\\n🎯 Tips for better generation:")
print("  • Adjust temperature (0.1-1.0) for creativity vs coherence")
print("  • Use top_p for nucleus sampling")
print("  • Increase max_length for longer stories")

# Display the stories DataFrame
print("\\n📚 All Generated Stories:")
df[['prompt', 'word_count']]`,
    requiredPackages: ["transformers-js-py", "pandas"]
  },

  // Hugging Face Template 3: Zero-Shot Classification
  {
    id: "hf_zero_shot_classification",
    name: "Smart Text Classifier",
    description: "Classify any text into custom categories without training data",
    category: "hf",
    tags: ["huggingface", "classification", "zero-shot", "categories"],
    code: `# Zero-Shot Text Classification
# Using Xenova/distilbert-base-uncased-mnli for flexible classification

print("🏷️ Smart Text Classifier")
print("=" * 30)

# Load zero-shot classification pipeline
pipeline = transformers.pipeline
classifier = await pipeline('zero-shot-classification', 'Xenova/distilbert-base-uncased-mnli')

# Sample texts to classify (could be from your database)
sample_texts = [
    "The new iPhone has amazing camera quality and great battery life",
    "Bitcoin price surged 15% after the Fed announcement",
    "Scientists discover new species in Amazon rainforest",
    "Manchester United wins 3-1 against Liverpool",
    "New AI model breaks language understanding records",
    "Netflix releases trailer for upcoming sci-fi series",
    "Healthy eating tips for busy professionals",
    "Real estate market shows signs of recovery"
]

# Define custom categories for classification
categories = {
    "Business Topics": ["technology", "finance", "business", "economy"],
    "Science & Research": ["science", "research", "health", "environment"],
    "Entertainment": ["sports", "movies", "entertainment", "gaming"],
    "Lifestyle": ["food", "travel", "lifestyle", "fitness"]
}

print("📊 Classifying texts into custom categories...")
print("Categories:", list(categories.keys()))
print("=" * 50)

classification_results = []

for i, text in enumerate(sample_texts, 1):
    print(f"\\n{i}. 📝 Text: '{text[:60]}...'")
    
    # Classify against all category labels
    all_labels = [label for cat_labels in categories.values() for label in cat_labels]
    result = await classifier(text, all_labels)
    
    # Get top 3 predictions
    top_predictions = list(zip(result['labels'][:3], result['scores'][:3]))
    
    # Find which main category this belongs to
    top_label = result['labels'][0]
    main_category = None
    for cat_name, cat_labels in categories.items():
        if top_label in cat_labels:
            main_category = cat_name
            break
    
    print(f"   🎯 Main Category: {main_category}")
    print(f"   📊 Top predictions:")
    for label, score in top_predictions:
        print(f"      {label}: {score:.1%}")
    
    classification_results.append({
        'text': text[:50] + "..." if len(text) > 50 else text,
        'main_category': main_category,
        'top_label': top_label,
        'confidence': result['scores'][0],
        'all_predictions': dict(zip(result['labels'][:5], result['scores'][:5]))
    })

# Analysis of classification results
import pandas as pd
df = pd.DataFrame(classification_results)

print("\\n\\n📈 Classification Summary:")
category_counts = df['main_category'].value_counts()
for category, count in category_counts.items():
    print(f"  {category}: {count} texts ({count/len(df)*100:.1f}%)")

print(f"\\n🎯 Average Confidence: {df['confidence'].mean():.1%}")
print(f"🔍 High Confidence (>80%): {sum(df['confidence'] > 0.8)} texts")

print("\\n💡 Use Cases:")
print("  • Customer support ticket routing")
print("  • Content categorization")  
print("  • News article classification")
print("  • Social media monitoring")

# Display results
df[['text', 'main_category', 'confidence']]`,
    requiredPackages: ["transformers-js-py", "pandas"]
  },

  // Hugging Face Template 4: Question Answering with Context
  {
    id: "hf_question_answering",
    name: "Smart Q&A System",
    description: "Answer questions based on your document content using BERT",
    category: "hf",
    tags: ["huggingface", "question-answering", "information-extraction"],
    code: `# Smart Question Answering System
# Using Xenova/distilbert-base-cased-distilled-squad for document Q&A

print("🤔 Smart Question Answering System")
print("=" * 40)

# Load question-answering pipeline
pipeline = transformers.pipeline
qa_pipe = await pipeline('question-answering', 'Xenova/distilbert-base-cased-distilled-squad')

# Sample document context (replace with your actual documents/data)
company_context = """
DataKit is a modern data analysis platform that combines the power of SQL and Python. 
Built on DuckDB, it provides lightning-fast analytical queries on large datasets. 
The platform supports multiple data formats including CSV, JSON, Parquet, and Excel files.
DataKit features an integrated notebook environment where users can seamlessly switch 
between SQL queries and Python data analysis. The platform now includes Hugging Face 
transformers for advanced NLP capabilities, enabling sentiment analysis, text generation, 
and document question answering directly in the workflow. DataKit is designed for 
data scientists, analysts, and researchers who need powerful yet user-friendly tools.
The platform runs entirely in the browser using WebAssembly, requiring no server setup.
"""

# Questions to ask about the context
questions = [
    "What database engine does DataKit use?",
    "What file formats does DataKit support?",
    "Who is DataKit designed for?",
    "Does DataKit require server setup?",
    "What NLP capabilities does DataKit include?",
    "Where does DataKit run?",
    "What can users do in the notebook environment?"
]

print("📄 Document Context Preview:")
print(f"'{company_context[:100]}...'")
print(f"📏 Context length: {len(company_context.split())} words")

print("\\n🔍 Asking questions about the document...")
print("=" * 50)

qa_results = []

for i, question in enumerate(questions, 1):
    print(f"\\n{i}. ❓ Q: {question}")
    
    # Get answer from the context
    result = await qa_pipe({
        'question': question,
        'context': company_context
    })
    
    answer = result['answer']
    confidence = result['score']
    
    # Determine confidence level
    conf_emoji = "🎯" if confidence > 0.8 else "🤔" if confidence > 0.5 else "❓"
    conf_level = "High" if confidence > 0.8 else "Medium" if confidence > 0.5 else "Low"
    
    print(f"   {conf_emoji} A: {answer}")
    print(f"   📊 Confidence: {confidence:.1%} ({conf_level})")
    
    qa_results.append({
        'question': question,
        'answer': answer,  
        'confidence': confidence,
        'confidence_level': conf_level
    })

# Analysis of Q&A performance
import pandas as pd
df = pd.DataFrame(qa_results)

print("\\n\\n📈 Q&A System Performance:")
print(f"❓ Total questions answered: {len(df)}")
print(f"🎯 High confidence answers (>80%): {sum(df['confidence'] > 0.8)}")
print(f"🤔 Medium confidence answers (50-80%): {sum((df['confidence'] > 0.5) & (df['confidence'] <= 0.8))}")
print(f"❓ Low confidence answers (<50%): {sum(df['confidence'] <= 0.5)}")
print(f"📊 Average confidence: {df['confidence'].mean():.1%}")

print("\\n💡 Tips for better Q&A:")
print("  • Provide clear, detailed context")
print("  • Ask specific, direct questions")
print("  • Context should contain the answer information")
print("  • Longer contexts may reduce accuracy")

# Display all Q&A pairs
print("\\n📋 Complete Q&A Results:")
df[['question', 'answer', 'confidence_level']]`,
    requiredPackages: ["transformers-js-py", "pandas"]
  },

  // Hugging Face Template 5: Feature Extraction + Data Analysis
  {
    id: "hf_feature_extraction",
    name: " Text Feature Extraction",
    description: "Extract semantic features from text and perform similarity analysis",
    category: "hf",
    tags: ["huggingface", "feature-extraction", "embeddings", "similarity"],
    code: `# 🧠 Text Feature Extraction & Similarity Analysis
# Using Xenova/all-MiniLM-L6-v2 for sentence embeddings

print("🧠 Text Feature Extraction & Similarity Analysis")
print("=" * 50)

# Load feature extraction pipeline
pipeline = transformers.pipeline
feature_extractor = await pipeline('feature-extraction', 'Xenova/all-MiniLM-L6-v2')

# Sample product descriptions (replace with your text data)
product_descriptions = [
    "High-quality wireless headphones with noise cancellation",
    "Bluetooth earbuds with excellent sound quality", 
    "Professional gaming keyboard with RGB lighting",
    "Mechanical keyboard for coding and gaming",
    "Lightweight laptop for business and travel",
    "Powerful desktop computer for video editing",
    "Smartphone with advanced camera features",
    "Digital camera for professional photography",
    "Fitness tracker with heart rate monitor",
    "Smartwatch with health monitoring features"
]

print("📝 Extracting features from product descriptions...")
print(f"🔢 Processing {len(product_descriptions)} items...")

# Extract embeddings for all descriptions
embeddings = []
for i, description in enumerate(product_descriptions):
    print(f"  {i+1:2d}. Processing: '{description[:40]}...'")
    
    # Get embedding (feature vector)
    embedding = await feature_extractor(description)
    # Extract the pooled embedding (mean pooling)
    import numpy as np
    embedding_array = np.array(embedding[0])
    # Ensure numeric type and handle nested arrays
    if embedding_array.ndim > 2:
        embedding_array = embedding_array[0]
    pooled_embedding = np.mean(embedding_array.astype(float), axis=0)
    embeddings.append(pooled_embedding)

embeddings = np.array(embeddings)
print(f"✅ Extracted embeddings shape: {embeddings.shape}")

# Calculate similarity matrix
print("\\n🔍 Calculating similarity matrix...")
from sklearn.metrics.pairwise import cosine_similarity
similarity_matrix = cosine_similarity(embeddings)

# Find most similar pairs
print("\\n🎯 Most Similar Product Pairs:")
import pandas as pd

similarities = []
for i in range(len(product_descriptions)):
    for j in range(i+1, len(product_descriptions)):
        similarities.append({
            'product_1': product_descriptions[i][:30] + "...",
            'product_2': product_descriptions[j][:30] + "...",
            'similarity': similarity_matrix[i][j],
            'index_1': i,
            'index_2': j
        })

# Sort by similarity and show top 5
similarities_df = pd.DataFrame(similarities)
top_similar = similarities_df.nlargest(5, 'similarity')

for idx, row in top_similar.iterrows():
    print(f"  📊 {row['similarity']:.1%} | {row['product_1']} ↔ {row['product_2']}")

# Find products similar to a query
print("\\n🔎 Query-based Similarity Search:")
query = "wireless audio device"
print(f"Query: '{query}'")

# Get query embedding
query_embedding = await feature_extractor(query)
query_array = np.array(query_embedding[0])
if query_array.ndim > 2:
    query_array = query_array[0]
query_pooled = np.mean(query_array.astype(float), axis=0).reshape(1, -1)

# Calculate similarities to query
query_similarities = cosine_similarity(query_pooled, embeddings)[0]

# Create results dataframe
results_df = pd.DataFrame({
    'product': [desc[:40] + "..." if len(desc) > 40 else desc for desc in product_descriptions],
    'similarity_to_query': query_similarities
}).sort_values('similarity_to_query', ascending=False)

print("\\nTop 3 matches:")
for idx, row in results_df.head(3).iterrows():
    print(f"  🎯 {row['similarity_to_query']:.1%} | {row['product']}")

# Clustering analysis
print("\\n🔬 Clustering Analysis:")
from sklearn.cluster import KMeans

# Perform k-means clustering
n_clusters = 3
kmeans = KMeans(n_clusters=n_clusters, random_state=42)
clusters = kmeans.fit_predict(embeddings)

# Show cluster assignments
cluster_df = pd.DataFrame({
    'product': product_descriptions,
    'cluster': clusters
})

for cluster_id in range(n_clusters):
    cluster_products = cluster_df[cluster_df['cluster'] == cluster_id]['product'].tolist()
    print(f"\\n  📦 Cluster {cluster_id + 1}:")
    for product in cluster_products:
        print(f"    • {product}")

print("\\n💡 Use Cases:")
print("  • Product recommendation systems")
print("  • Document similarity search")
print("  • Content deduplication")
print("  • Semantic search engines")

# Display final results
print("\\n📊 Similarity Matrix (first 5x5):")
similarity_df = pd.DataFrame(
    similarity_matrix[:5, :5], 
    columns=[f"P{i+1}" for i in range(5)],
    index=[f"P{i+1}" for i in range(5)]
)
similarity_df.round(3)`,
    requiredPackages: ["transformers-js-py", "pandas", "numpy", "scikit-learn"]
  },

  // Advanced Hugging Face Template: ML Pipeline with Web Data
  {
    id: "hf_advanced_ml_pipeline",
    name: "ML Pipeline",
    description: "Fetch web data, analyze with HuggingFace models, and build ML classifiers with scikit-learn",
    category: "hf",
    tags: ["huggingface", "scikit-learn", "requests", "web-scraping", "machine-learning", "pipeline"],
    code: `# ML Pipeline: Web Data + HuggingFace + Scikit-Learn
# Demonstrates fetching data, NLP analysis, and traditional ML integration

print(" Advanced ML Pipeline Demo")
print("=" * 50)

# Step 1: Install required packages and setup
print(" Setting up packages...")
try:
    # Check if requests is available, install if needed
    import requests
    print("✅ requests available")
except ImportError:
    print("📥 Installing requests...")
    await micropip.install('requests')
    import requests
    print("✅ requests installed")

try:
    from sklearn.ensemble import RandomForestClassifier
    from sklearn.model_selection import train_test_split
    from sklearn.metrics import classification_report, accuracy_score
    from sklearn.preprocessing import StandardScaler
    print("✅ scikit-learn available")
except ImportError:
    print("📥 Installing scikit-learn...")
    await micropip.install('scikit-learn')
    from sklearn.ensemble import RandomForestClassifier
    from sklearn.model_selection import train_test_split
    from sklearn.metrics import classification_report, accuracy_score
    from sklearn.preprocessing import StandardScaler
    print("✅ scikit-learn installed")

import pandas as pd
import numpy as np
import json

# Step 2: Simulate fetching news articles (replace with real API)
print("\\n📰 Fetching sample news data...")

# Sample news articles (in real scenario, you'd fetch from news API)
sample_news = [
    # Business articles
    {
        "title": "Stock Market Reaches New Highs Amid Economic Recovery",
        "content": "The stock market surged today as investors showed confidence in the economic recovery. Tech stocks led the gains with Apple and Microsoft posting strong quarterly results.",
        "category": "business"
    },
    {
        "title": "Federal Reserve Announces Interest Rate Decision",
        "content": "The Federal Reserve maintained interest rates at current levels, citing steady economic growth. Markets responded positively to the announcement with moderate gains across sectors.",
        "category": "business"
    },
    {
        "title": "Major Merger Creates Banking Giant",
        "content": "Two of the nation's largest banks announced a merger worth $50 billion. The combined entity will become the second-largest financial institution in the country.",
        "category": "business"
    },
    # Science articles
    {
        "title": "Scientists Discover New Species in Amazon Rainforest", 
        "content": "Researchers have identified a new species of colorful frog in the Amazon basin. The discovery highlights the rich biodiversity of the rainforest and the urgent need for conservation.",
        "category": "science"
    },
    {
        "title": "Breakthrough in Quantum Computing Achieved",
        "content": "Scientists have successfully demonstrated quantum supremacy with a new quantum processor. This achievement could revolutionize computing and solve complex problems impossible for classical computers.",
        "category": "science"
    },
    {
        "title": "Mars Rover Finds Evidence of Ancient Water",
        "content": "NASA's latest Mars rover has discovered mineral deposits that could only form in the presence of water. This finding supports theories about Mars having a wet past billions of years ago.",
        "category": "science"
    },
    # Sports articles
    {
        "title": "Championship Game Breaks Viewership Records",
        "content": "Last night's championship game attracted over 100 million viewers, making it the most-watched sporting event of the year. The thrilling overtime finish kept fans on the edge of their seats.",
        "category": "sports"
    },
    {
        "title": "Olympic Athlete Sets New World Record",
        "content": "In a stunning performance, the young athlete shattered the previous world record by over two seconds. This achievement marks a new era in the sport.",
        "category": "sports"
    },
    {
        "title": "Team Wins First Championship in 50 Years",
        "content": "The underdog team completed their miracle season by winning their first championship in five decades. Fans celebrated in the streets as history was made.",
        "category": "sports"
    },
    # Technology articles
    {
        "title": "New AI Model Revolutionizes Medical Diagnosis",
        "content": "A groundbreaking artificial intelligence model developed by researchers can now diagnose rare diseases with 95% accuracy. This breakthrough could transform healthcare delivery worldwide.",
        "category": "technology"
    },
    {
        "title": "Major Tech Company Unveils Revolutionary Smartphone",
        "content": "The new smartphone features breakthrough battery technology that lasts up to a week on a single charge. Industry experts predict this could change mobile computing forever.",
        "category": "technology"
    },
    {
        "title": "Cybersecurity Firm Discovers Major Vulnerability",
        "content": "Security researchers have uncovered a critical vulnerability affecting millions of devices worldwide. Companies are rushing to patch their systems before hackers can exploit the flaw.",
        "category": "technology"
    },
    # Politics articles
    {
        "title": "Climate Summit Reaches Historic Agreement",
        "content": "World leaders at the climate summit have agreed to ambitious new targets for carbon reduction. The agreement includes binding commitments and substantial funding for renewable energy projects.",
        "category": "politics"
    },
    {
        "title": "New Healthcare Bill Passes Congress",
        "content": "After months of debate, Congress has passed comprehensive healthcare reform. The bill promises to expand coverage to millions of uninsured Americans.",
        "category": "politics"
    },
    {
        "title": "International Trade Deal Signed",
        "content": "Representatives from multiple nations signed a historic trade agreement today. The deal is expected to boost economic growth and create thousands of new jobs.",
        "category": "politics"
    },
    # Entertainment articles
    {
        "title": "Hollywood Blockbuster Breaks Box Office Records",
        "content": "The latest superhero movie has shattered opening weekend records, earning over $300 million globally. Critics praise the film's stunning visual effects and compelling storyline.",
        "category": "entertainment"
    },
    {
        "title": "Music Festival Announces Star-Studded Lineup",
        "content": "The annual music festival revealed its lineup featuring top artists from around the world. Tickets sold out within minutes of going on sale.",
        "category": "entertainment"
    },
    {
        "title": "Streaming Service Wins Multiple Awards",
        "content": "The popular streaming platform dominated the awards ceremony, taking home prizes in multiple categories. Their original content continues to reshape the entertainment industry.",
        "category": "entertainment"
    }
]

print(f"Loaded {len(sample_news)} sample articles")

# Step 3: Use HuggingFace for NLP analysis
print("\\n🤗 Analyzing articles with HuggingFace models...")

# Load multiple HF pipelines
pipeline = transformers.pipeline

# Sentiment analysis
print("  Loading sentiment analysis...")
sentiment_pipe = await pipeline('sentiment-analysis', 'Xenova/distilbert-base-uncased-finetuned-sst-2-english')

# Feature extraction - skip for now due to format issues
# We'll use other features instead
print("  Skipping embeddings (using text features instead)...")

# Zero-shot classification
print("  Loading zero-shot classifier...")
classifier_pipe = await pipeline('zero-shot-classification', 'Xenova/distilbert-base-uncased-mnli')

# Categories for classification
hf_categories = ["finance", "science", "sports", "technology", "politics", "entertainment"]

print("All HuggingFace models loaded!")

# Step 4: Process articles with HF models
print("\\n🔄 Processing articles...")
processed_articles = []

for i, article in enumerate(sample_news):
    print(f"  Processing article {i+1}/{len(sample_news)}: '{article['title'][:50]}...'")
    
    text = f"{article['title']} {article['content']}"
    
    # Sentiment analysis
    sentiment_result = await sentiment_pipe(text)
    sentiment = sentiment_result[0]
    
    # Calculate text-based features instead of embeddings
    # Count words by category keywords
    tech_words = ['tech', 'technology', 'AI', 'software', 'digital', 'computer', 'data']
    business_words = ['market', 'stock', 'finance', 'economy', 'investor', 'company', 'business']
    science_words = ['research', 'scientist', 'study', 'discovery', 'species', 'medical']
    
    text_lower = text.lower()
    tech_score = sum(1 for word in tech_words if word.lower() in text_lower)
    business_score = sum(1 for word in business_words if word.lower() in text_lower)
    science_score = sum(1 for word in science_words if word.lower() in text_lower)
    
    # Zero-shot classification
    classification_result = await classifier_pipe(text, hf_categories)
    predicted_category = classification_result['labels'][0]
    category_confidence = classification_result['scores'][0]
    
    processed_articles.append({
        'title': article['title'],
        'content': article['content'][:100] + "..." if len(article['content']) > 100 else article['content'],
        'true_category': article['category'],
        'predicted_category': predicted_category,
        'category_confidence': category_confidence,
        'sentiment_label': sentiment['label'],
        'sentiment_score': sentiment['score'],
        'tech_score': tech_score,
        'business_score': business_score,
        'science_score': science_score,
        'text_length': len(text),
        'word_count': len(text.split())
    })

print("✅ All articles processed!")

# Step 5: Create dataset for machine learning
print("\\nCreating ML dataset...")

# Create DataFrame
df = pd.DataFrame(processed_articles)

# Extract features for ML
features_df = pd.DataFrame({
    'sentiment_score': df['sentiment_score'],
    'category_confidence': df['category_confidence'], 
    'text_length': df['text_length'],
    'word_count': df['word_count'],
    'sentiment_positive': (df['sentiment_label'] == 'POSITIVE').astype(int),
    'tech_score': df['tech_score'],
    'business_score': df['business_score'],
    'science_score': df['science_score']
})

print(f" Created feature matrix: {features_df.shape}")

# Step 6: Train ML classifier to predict true category
print("\\n Training scikit-learn classifier...")

# Prepare data
X = features_df.values
y = df['true_category'].values

# Split data
X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.3, random_state=42, stratify=y)

# Scale features
scaler = StandardScaler()
X_train_scaled = scaler.fit_transform(X_train)
X_test_scaled = scaler.transform(X_test)

# Train Random Forest
rf_classifier = RandomForestClassifier(n_estimators=100, random_state=42)
rf_classifier.fit(X_train_scaled, y_train)

# Make predictions
y_pred = rf_classifier.predict(X_test_scaled)

# Evaluate
accuracy = accuracy_score(y_test, y_pred)
print(f" Random Forest Accuracy: {accuracy:.2%}")

# Step 7: Compare HuggingFace vs Scikit-Learn predictions
print("\\n Model Comparison Analysis:")

# Create comparison DataFrame
comparison_df = df[['title', 'true_category', 'predicted_category', 'category_confidence']].copy()

# Add scikit-learn predictions for full dataset
X_full_scaled = scaler.transform(features_df.values)
sklearn_predictions = rf_classifier.predict(X_full_scaled)
sklearn_probabilities = rf_classifier.predict_proba(X_full_scaled)

comparison_df['sklearn_category'] = sklearn_predictions
comparison_df['sklearn_confidence'] = np.max(sklearn_probabilities, axis=1)

# Calculate accuracies
hf_accuracy = (comparison_df['predicted_category'] == comparison_df['true_category']).mean()
sklearn_accuracy = (comparison_df['sklearn_category'] == comparison_df['true_category']).mean()

print(f"HuggingFace Zero-Shot Accuracy: {hf_accuracy:.2%}")
print(f"Scikit-Learn RF Accuracy: {sklearn_accuracy:.2%}")

# Step 8: Feature importance analysis
print("\\n🔍 Feature Importance Analysis:")
feature_names = features_df.columns.tolist()
importances = rf_classifier.feature_importances_

feature_importance_df = pd.DataFrame({
    'feature': feature_names,
    'importance': importances
}).sort_values('importance', ascending=False)

print("Top 5 most important features:")
for idx, row in feature_importance_df.head().iterrows():
    print(f"  {row['feature']}: {row['importance']:.3f}")

# Step 9: Final results and insights
print("\\n Pipeline Results Summary:")
print("=" * 40)
print(f" Articles processed: {len(sample_news)}")
print(f" Sentiment distribution:")
sentiment_counts = df['sentiment_label'].value_counts()
for sentiment, count in sentiment_counts.items():
    print(f"   {sentiment}: {count} ({count/len(df)*100:.1f}%)")

print(f"\\nCategory prediction comparison:")
print(f"   HuggingFace accuracy: {hf_accuracy:.1%}")
print(f"   Scikit-Learn accuracy: {sklearn_accuracy:.1%}")

print(f"\\n ML Model Performance:")
print(f"   Features used: {features_df.shape[1]}")
print(f"   Training samples: {len(X_train)}")
print(f"   Test accuracy: {accuracy:.1%}")

# Display detailed results
print("\\n Detailed Article Analysis:")
display_df = comparison_df[['title', 'true_category', 'predicted_category', 'sklearn_category']].copy()
display_df.columns = ['Article Title', 'True Category', 'HF Prediction', 'SKLearn Prediction']

print("\\n Use Cases for this Pipeline:")
print("  • News article classification and routing")
print("  • Content recommendation systems") 
print("  • Automated content tagging")
print("  • Market sentiment analysis")
print("  • Research paper categorization")
print("  • Social media content analysis")

display_df`,
    requiredPackages: ["transformers-js-py", "pandas", "numpy", "scikit-learn", "requests"]
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
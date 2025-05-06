// wasm-src/data-processing/src/csv.rs
use serde::{Serialize, Deserialize};

#[derive(Serialize, Deserialize)]
pub enum ColumnType {
    Number,
    Text,
    Date,
    Boolean,
    Unknown
}

pub fn parse_csv(data: &str, delimiter: char) -> Vec<Vec<String>> {
    let mut result = Vec::new();
    
    for line in data.lines() {
        let mut row = Vec::new();
        let mut field = String::new();
        let mut in_quotes = false;
        
        for c in line.chars() {
            if c == '"' {
                in_quotes = !in_quotes;
            } else if c == delimiter && !in_quotes {
                row.push(field.clone());
                field.clear();
            } else {
                field.push(c);
            }
        }
        
        // Don't forget the last field
        row.push(field.clone());
        result.push(row);
    }
    
    result
}

pub fn detect_column_types(data: &Vec<Vec<String>>) -> Vec<ColumnType> {
    if data.is_empty() || data.len() < 2 {
        return Vec::new();
    }
    
    let header_row = &data[0];
    let mut column_types = vec![ColumnType::Unknown; header_row.len()];
    
    // Skip header row
    for row in data.iter().skip(1) {
        for (i, cell) in row.iter().enumerate() {
            if i >= column_types.len() {
                break;
            }
            
            // Try to parse as number
            if let Ok(_) = cell.parse::<f64>() {
                if matches!(column_types[i], ColumnType::Unknown) {
                    column_types[i] = ColumnType::Number;
                }
                continue;
            }
            
            // Try to parse as boolean
            if cell.eq_ignore_ascii_case("true") || 
               cell.eq_ignore_ascii_case("false") ||
               cell.eq_ignore_ascii_case("yes") ||
               cell.eq_ignore_ascii_case("no") {
                if matches!(column_types[i], ColumnType::Unknown) {
                    column_types[i] = ColumnType::Boolean;
                }
                continue;
            }
            
            // Try to parse as date
            if cell.contains('-') && cell.chars().filter(|&c| c == '-').count() == 2 {
                if matches!(column_types[i], ColumnType::Unknown) {
                    column_types[i] = ColumnType::Date;
                }
                continue;
            }
            
            // Default to text
            column_types[i] = ColumnType::Text;
        }
    }
    
    column_types
}
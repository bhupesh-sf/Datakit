// wasm-src/data-processing/src/lib.rs
mod csv;

use wasm_bindgen::prelude::*;

#[wasm_bindgen]
pub fn parse_csv(data: &str, delimiter: char) -> JsValue {
    let result = csv::parse_csv(data, delimiter);
    serde_wasm_bindgen::to_value(&result).unwrap()
}

#[wasm_bindgen]
pub fn get_column_types(data: JsValue) -> JsValue {
    let parsed_data: Vec<Vec<String>> = serde_wasm_bindgen::from_value(data).unwrap();
    let types = csv::detect_column_types(&parsed_data);
    serde_wasm_bindgen::to_value(&types).unwrap()
}
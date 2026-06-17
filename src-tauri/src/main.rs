#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use std::{
    fs,
    path::PathBuf,
    process::Command,
    time::{SystemTime, UNIX_EPOCH},
};

use image::imageops;
use serde::Serialize;
use tauri::Manager;
use xcap::Window;

#[derive(Serialize)]
struct CaptureResult {
    path: String,
    width: u32,
    height: u32,
}

#[tauri::command]
fn capture_clean_screenshot(
    crop_top: f64,
    viewport_height: f64,
    label: String,
) -> Result<CaptureResult, String> {
    let target = focused_clean_browser_window()?;
    let image = target.capture_image().map_err(to_message)?;
    let width = image.width();
    let height = image.height();
    let crop_top_px = scaled_crop_top(crop_top, viewport_height, height);
    let clean_height = height
        .checked_sub(crop_top_px)
        .ok_or_else(|| "Invalid screenshot crop".to_string())?;

    let output = if crop_top_px == 0 {
        image
    } else {
        imageops::crop_imm(&image, 0, crop_top_px, width, clean_height).to_image()
    };

    let directory = screenshots_directory()?;
    let filename = screenshot_filename(&label);
    let path = directory.join(filename);
    output.save(&path).map_err(to_message)?;

    Ok(CaptureResult {
        path: path.to_string_lossy().to_string(),
        width: output.width(),
        height: output.height(),
    })
}

#[tauri::command]
fn reveal_in_finder(path: String) -> Result<(), String> {
    if path.trim().is_empty() {
        return Ok(());
    }

    #[cfg(target_os = "macos")]
    {
        Command::new("open")
            .arg("-R")
            .arg(&path)
            .status()
            .map_err(to_message)?;
    }

    #[cfg(not(target_os = "macos"))]
    {
        let target = Path::new(&path)
            .parent()
            .map(Path::to_path_buf)
            .unwrap_or_else(|| PathBuf::from("."));
        open_folder(&target)?;
    }

    Ok(())
}

fn focused_clean_browser_window() -> Result<Window, String> {
    let windows = Window::all().map_err(to_message)?;

    windows
        .iter()
        .find(|window| window.is_focused().unwrap_or(false) && is_clean_browser_window(window))
        .cloned()
        .or_else(|| {
            windows
                .iter()
                .find(|window| window.is_focused().unwrap_or(false))
                .cloned()
        })
        .or_else(|| {
            windows
                .iter()
                .find(|window| is_clean_browser_window(window))
                .cloned()
        })
        .ok_or_else(|| "Could not find the Clean Browser window".to_string())
}

fn is_clean_browser_window(window: &Window) -> bool {
    let app_name = window.app_name().unwrap_or_default().to_lowercase();
    let title = window.title().unwrap_or_default().to_lowercase();

    app_name.contains("clean browser")
        || app_name.contains("clean-browser")
        || title.contains("clean browser")
        || title.contains("clean-browser")
}

fn scaled_crop_top(crop_top: f64, viewport_height: f64, image_height: u32) -> u32 {
    if crop_top <= 0.0 || viewport_height <= 0.0 || image_height == 0 {
        return 0;
    }

    ((image_height as f64) * (crop_top / viewport_height))
        .round()
        .clamp(0.0, image_height.saturating_sub(1) as f64) as u32
}

fn screenshots_directory() -> Result<PathBuf, String> {
    let home = std::env::var_os("HOME").ok_or_else(|| "Could not locate HOME".to_string())?;
    let directory = PathBuf::from(home).join("Pictures").join("Clean Browser");
    fs::create_dir_all(&directory).map_err(to_message)?;
    Ok(directory)
}

fn screenshot_filename(label: &str) -> String {
    let timestamp = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|duration| duration.as_secs())
        .unwrap_or_default();
    let slug = slugify(label);

    format!("clean-browser-{slug}-{timestamp}.png")
}

fn slugify(value: &str) -> String {
    let mut slug = String::new();

    for character in value.chars() {
        if character.is_ascii_alphanumeric() {
            slug.push(character.to_ascii_lowercase());
        } else if matches!(character, '-' | '_' | '.' | ' ') && !slug.ends_with('-') {
            slug.push('-');
        }

        if slug.len() >= 48 {
            break;
        }
    }

    let slug = slug.trim_matches('-').to_string();

    if slug.is_empty() {
        "capture".to_string()
    } else {
        slug
    }
}

#[cfg(not(target_os = "macos"))]
fn open_folder(path: &std::path::Path) -> Result<(), String> {
    #[cfg(target_os = "windows")]
    let mut command = {
        let mut command = Command::new("explorer");
        command.arg(path);
        command
    };

    #[cfg(target_os = "linux")]
    let mut command = {
        let mut command = Command::new("xdg-open");
        command.arg(path);
        command
    };

    command.status().map_err(to_message)?;
    Ok(())
}

fn to_message(error: impl std::fmt::Display) -> String {
    error.to_string()
}

fn main() {
    tauri::Builder::default()
        .setup(|app| {
            if let Some(window) = app.get_window("main") {
                let _ = window.set_title("Clean Browser");
            }

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            capture_clean_screenshot,
            reveal_in_finder
        ])
        .run(tauri::generate_context!())
        .expect("error while running Clean Browser");
}

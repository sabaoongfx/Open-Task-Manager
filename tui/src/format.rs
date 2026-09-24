// Mirrors src/format.ts so the terminal UI shows numbers the same way the GUI does.

pub fn bytes(bytes: u64) -> String {
    let mb = bytes as f64 / 1024.0 / 1024.0;
    if mb < 1024.0 {
        format!("{mb:.1} MB")
    } else {
        format!("{:.2} GB", mb / 1024.0)
    }
}

pub fn rate(bytes_per_sec: f64) -> String {
    let mbps = bytes_per_sec / 1024.0 / 1024.0;
    if mbps < 0.05 {
        "0 MB/s".to_string()
    } else {
        format!("{mbps:.1} MB/s")
    }
}

pub fn hz(mhz: u64) -> String {
    match mhz {
        0 => "—".to_string(),
        m if m >= 1000 => format!("{:.2} GHz", m as f64 / 1000.0),
        m => format!("{m} MHz"),
    }
}

pub fn uptime(total_seconds: f64) -> String {
    let total = total_seconds.max(0.0) as u64;
    let (days, hours, minutes, seconds) = (total / 86400, (total % 86400) / 3600, (total % 3600) / 60, total % 60);
    if days > 0 {
        format!("{days}:{hours:02}:{minutes:02}:{seconds:02}")
    } else {
        format!("{hours:02}:{minutes:02}:{seconds:02}")
    }
}

pub fn gb(bytes: u64) -> String {
    format!("{:.1} GB", bytes as f64 / 1024.0 / 1024.0 / 1024.0)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn formats_like_the_gui() {
        assert_eq!(bytes(512 * 1024 * 1024), "512.0 MB");
        assert_eq!(bytes(3 * 1024 * 1024 * 1024), "3.00 GB");
        assert_eq!(rate(1024.0), "0 MB/s");
        assert_eq!(rate(2.5 * 1024.0 * 1024.0), "2.5 MB/s");
        assert_eq!(hz(0), "—");
        assert_eq!(hz(800), "800 MHz");
        assert_eq!(hz(3400), "3.40 GHz");
        assert_eq!(uptime(3725.0), "01:02:05");
        assert_eq!(uptime(90061.0), "1:01:01:01");
    }
}

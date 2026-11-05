//! Erros de comando como códigos curtos, traduzidos no front (`error.<code>`).
//!
//! Formato da string: `"<code>"` ou `"<code>|<detalhe>"`. `code` é snake_case ASCII;
//! `detalhe` é texto livre (caminho, erro do SO) mostrado como está.

/// Erro sem detalhe: `"<code>"`.
pub fn err(code: &str) -> String {
    code.to_string()
}

/// Erro com detalhe: `"<code>|<detalhe>"`.
pub fn err_d(code: &str, detail: impl std::fmt::Display) -> String {
    format!("{code}|{detail}")
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn err_sem_detalhe_e_so_o_codigo() {
        assert_eq!(err("rawaccel_not_found"), "rawaccel_not_found");
    }

    #[test]
    fn err_d_formata_codigo_e_detalhe() {
        assert_eq!(err_d("read_dir_failed", "C:/stats: acesso negado"), "read_dir_failed|C:/stats: acesso negado");
        assert_eq!(err_d("invalid_dpi", 42), "invalid_dpi|42");
    }
}

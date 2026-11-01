async function doRegister() {
    const email = $('regEmail').value.trim();
    const u = $('regUser').value.trim().toLowerCase();
    const p = $('regPass').value;
    const p2 = $('regPass2').value;
    const n = $('regName').value.trim();

    if (!/^[a-z0-9_]{4,20}$/.test(u))
        return authMsg('Tên đăng nhập phải 4-20 ký tự, chỉ gồm chữ, số hoặc dấu _');

    if (p.length < 6)
        return authMsg('Mật khẩu phải có ít nhất 6 ký tự');

    if (p !== p2)
        return authMsg('Mật khẩu xác minh không khớp');

    if (n.length < 2 || n.length > 16)
        return authMsg('Tên hiển thị phải từ 2 đến 16 ký tự');

    if (!email)
        return authMsg('Vui lòng nhập địa chỉ Email');

    authMsg('Đang tạo tài khoản...');

    const { data, error } = await sb.auth.signUp({
        email: email,
        password: p,
        options: {
            data: {
                username: u,
                display_name: n
            }
        }
    });

    if (error) {
        console.error(error);
        return authMsg('Đăng ký thất bại: ' + error.message);
    }

    authMsg(
        'Đăng ký thành công! Hãy kiểm tra email để xác minh tài khoản.',
        true
    );
}
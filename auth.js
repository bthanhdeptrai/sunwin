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

async function doLogin() {
    const u = $('lgUser').value.trim().toLowerCase();
    const p = $('lgPass').value;

    if (!u || !p) {
        return authMsg('Vui lòng nhập tên đăng nhập và mật khẩu');
    }

    authMsg('Đang đăng nhập...');

    try {
        const { data, error } = await sb.functions.invoke(
            'quick-worker',
            {
                body: {
                    username: u,
                    password: p
                }
            }
        );

        if (error || !data || !data.session) {
            console.error('Login error:', error, data);
            return authMsg(
                data?.error || 'Tên đăng nhập hoặc mật khẩu không đúng'
            );
        }

        const { error: sessionError } = await sb.auth.setSession({
            access_token: data.session.access_token,
            refresh_token: data.session.refresh_token
        });

        if (sessionError) {
            console.error(sessionError);
            return authMsg('Không thể tạo phiên đăng nhập');
        }

        currentUser = data.user.username;
        gameState.balance = lastSavedBal = Number(data.user.balance);

        $('lbName').textContent = data.user.display_name;
        $('lbAvatar').textContent =
            data.user.display_name.charAt(0).toUpperCase();

        $('authScreen').style.display = 'none';
        $('lobby').style.display = 'flex';

        authMsg('');
        renderAll();

    } catch (e) {
        console.error(e);
        authMsg('Có lỗi kết nối. Vui lòng thử lại.');
    }
}
function playAsGuest() {
    currentUser = null;
    lastSavedBal = null;

    gameState.balance = 100000;

    Object.values(gameState.tables).forEach(t => {
        t.betAmount = 0;
    });

    $('lbName').textContent = 'Khách';
    $('lbAvatar').textContent = 'K';

    $('authScreen').style.display = 'none';
    $('lobby').style.display = 'flex';

    authMsg('');
    renderAll();
}
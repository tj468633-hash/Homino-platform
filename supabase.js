const supabaseClient = window.supabase.createClient(
    window.HOMINO_CONFIG.SUPABASE_URL,
    window.HOMINO_CONFIG.SUPABASE_ANON_KEY
);

// گرفتن کاربر فعلی
async function getCurrentUser() {
    const {
        data: { user },
        error
    } = await supabaseClient.auth.getUser();

    if (error) {
        console.error("خطا در دریافت کاربر:", error);
        return null;
    }

    return user;
}

// گرفتن پروفایل کاربر
async function getMyProfile() {
    const user = await getCurrentUser();

    if (!user) return null;

    const { data, error } = await supabaseClient
        .from("profiles")
        .select("*")
        .eq("id", user.id)
        .single();

    if (error) {
        console.error("خطا در دریافت پروفایل:", error);
        return null;
    }

    return data;
}

// دریافت دسته‌بندی‌ها
async function getCategories() {
    const { data, error } = await supabaseClient
        .from("service_categories")
        .select("*")
        .order("name");

    if (error) {
        console.error("خطا در دسته‌بندی‌ها:", error);
        return [];
    }

    return data || [];
}

// دریافت خدمات
async function getServices(categoryId = null) {
    let query = supabaseClient
        .from("services")
        .select(`
            *,
            service_categories (
                id,
                name
            )
        `)
        .order("name");

    if (categoryId) {
        query = query.eq("category_id", categoryId);
    }

    const { data, error } = await query;

    if (error) {
        console.error("خطا در خدمات:", error);
        return [];
    }

    return data || [];
}

// دریافت شهرها
async function getCities() {
    const { data, error } = await supabaseClient
        .from("cities")
        .select("*")
        .order("name");

    if (error) {
        console.error("خطا در شهرها:", error);
        return [];
    }

    return data || [];
}

// جستجوی متخصص‌ها
async function searchSpecialists(serviceId = null, cityId = null) {
    let query = supabaseClient
        .from("specialists")
        .select(`
            *,
            profiles (
                id,
                full_name,
                phone,
                avatar_url
            ),
            specialist_services (
                service_id,
                price_from,
                price_to,
                services (
                    id,
                    name
                )
            ),
            specialist_cities (
                city_id,
                cities (
                    id,
                    name
                )
            )
        `)
        .eq("status", "approved");

    const { data, error } = await query;

    if (error) {
        console.error("خطا در متخصص‌ها:", error);
        return [];
    }

    let specialists = data || [];

    if (serviceId) {
        specialists = specialists.filter(specialist =>
            specialist.specialist_services?.some(
                item => item.service_id === serviceId
            )
        );
    }

    if (cityId) {
        specialists = specialists.filter(specialist =>
            specialist.specialist_cities?.some(
                item => item.city_id === cityId
            )
        );
    }

    return specialists;
}

// ایجاد درخواست خدمات
async function createServiceRequest(requestData) {
    const user = await getCurrentUser();

    if (!user) {
        throw new Error("ابتدا باید وارد حساب کاربری شوید.");
    }

    const { data, error } = await supabaseClient
        .from("service_requests")
        .insert({
            customer_id: user.id,
            ...requestData
        })
        .select()
        .single();

    if (error) {
        console.error("خطا در ایجاد درخواست:", error);
        throw error;
    }

    return data;
}

// دریافت خانه‌های کاربر
async function getMyHomes() {
    const user = await getCurrentUser();

    if (!user) return [];

    const { data, error } = await supabaseClient
        .from("homes")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });

    if (error) {
        console.error("خطا در خانه‌ها:", error);
        return [];
    }

    return data || [];
}

// افزودن خانه
async function addHome(homeData) {
    const user = await getCurrentUser();

    if (!user) {
        throw new Error("ابتدا وارد حساب کاربری شوید.");
    }

    const { data, error } = await supabaseClient
        .from("homes")
        .insert({
            user_id: user.id,
            ...homeData
        })
        .select()
        .single();

    if (error) {
        console.error("خطا در افزودن خانه:", error);
        throw error;
    }

    return data;
}

// دریافت پروفایل متخصص
async function getMySpecialistProfile() {
    const user = await getCurrentUser();

    if (!user) return null;

    const { data, error } = await supabaseClient
        .from("specialists")
        .select("*")
        .eq("profile_id", user.id)
        .maybeSingle();

    if (error) {
        console.error("خطا در پروفایل متخصص:", error);
        return null;
    }

    return data;
}

// ثبت‌نام به عنوان متخصص
async function registerAsSpecialist(specialistData) {
    const user = await getCurrentUser();

    if (!user) {
        throw new Error("ابتدا وارد حساب کاربری شوید.");
    }

    const { data, error } = await supabaseClient
        .from("specialists")
        .insert({
            profile_id: user.id,
            ...specialistData,
            status: "pending"
        })
        .select()
        .single();

    if (error) {
        console.error("خطا در ثبت متخصص:", error);
        throw error;
    }

    return data;
}

// افزودن تخصص و قیمت
async function addSpecialistService(serviceId, priceFrom, priceTo) {
    const specialist = await getMySpecialistProfile();

    if (!specialist) {
        throw new Error("پروفایل متخصص پیدا نشد.");
    }

    const { data, error } = await supabaseClient
        .from("specialist_services")
        .insert({
            specialist_id: specialist.id,
            service_id: serviceId,
            price_from: priceFrom,
            price_to: priceTo
        })
        .select()
        .single();

    if (error) {
        console.error("خطا در افزودن تخصص:", error);
        throw error;
    }

    return data;
}

// افزودن یا حذف علاقه‌مندی
async function toggleFavorite(specialistId) {
    const user = await getCurrentUser();

    if (!user) {
        throw new Error("ابتدا وارد حساب کاربری شوید.");
    }

    const { data: existing } = await supabaseClient
        .from("favorite_specialists")
        .select("id")
        .eq("user_id", user.id)
        .eq("specialist_id", specialistId)
        .maybeSingle();

    if (existing) {
        await supabaseClient
            .from("favorite_specialists")
            .delete()
            .eq("id", existing.id);

        return false;
    }

    const { error } = await supabaseClient
        .from("favorite_specialists")
        .insert({
            user_id: user.id,
            specialist_id: specialistId
        });

    if (error) {
        console.error("خطا در علاقه‌مندی:", error);
        throw error;
    }

    return true;
}

// دریافت اعلان‌ها
async function getMyNotifications() {
    const user = await getCurrentUser();

    if (!user) return [];

    const { data, error } = await supabaseClient
        .from("notifications")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });

    if (error) {
        console.error("خطا در اعلان‌ها:", error);
        return [];
    }

    return data || [];
}

// خوانده‌شدن اعلان
async function markNotificationRead(notificationId) {
    const { error } = await supabaseClient
        .from("notifications")
        .update({
            is_read: true
        })
        .eq("id", notificationId);

    if (error) {
        console.error("خطا در اعلان:", error);
        throw error;
    }
}

// اتصال لحظه‌ای به درخواست‌ها
function subscribeToRequests(callback) {
    return supabaseClient
        .channel("homino-service-requests")
        .on(
            "postgres_changes",
            {
                event: "*",
                schema: "public",
                table: "service_requests"
            },
            payload => {
                callback(payload);
            }
        )
        .subscribe();
}

// اتصال لحظه‌ای به سفارش‌ها
function subscribeToOrders(callback) {
    return supabaseClient
        .channel("homino-orders")
        .on(
            "postgres_changes",
            {
                event: "*",
                schema: "public",
                table: "orders"
            },
            payload => {
                callback(payload);
            }
        )
        .subscribe();
}

console.log("HOMINO Supabase connected");

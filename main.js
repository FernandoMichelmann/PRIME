
"use strict";

document.addEventListener("DOMContentLoaded", () => {
    const $ = (selector, root = document) => root.querySelector(selector);
    const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];

    const money = (value) =>
        new Intl.NumberFormat("pt-BR", {
            style: "currency",
            currency: "BRL"
        }).format(Number(value) || 0);

    const escapeHTML = (value) =>
        String(value ?? "").replace(/[&<>"']/g, (char) => ({
            "&": "&amp;",
            "<": "&lt;",
            ">": "&gt;",
            '"': "&quot;",
            "'": "&#39;"
        })[char]);

    const localISO = (date = new Date()) => [
        date.getFullYear(),
        String(date.getMonth() + 1).padStart(2, "0"),
        String(date.getDate()).padStart(2, "0")
    ].join("-");

    const todayISO = localISO();
    const currentMonth = () => localISO().slice(0, 7);
    const monthKey = (date) => String(date || "").slice(0, 7);
    const STORAGE_KEY = "primeVariableExpensesV1";

    let toastTimeout;
    let cashflowChart;
    let expensesChart;
    let expensesPage = null;
    let revenuePage = null;
    let expenseFormDraft = null;
    let variableExpenseFilter = "all";
    const VEHICLE_TRIPS_STORAGE_KEY = "primeVehicleTripsV1";
    const VEHICLES_STORAGE_KEY = "primeVehiclesV1";
    let vehicleTrips = loadVehicleTrips();
    let registeredVehicles = loadRegisteredVehicles();

    const transactions = [];

    const categoryData = [
        { label: "Combustível", value: 0, color: "#3B82F6" },
        { label: "Manutenção", value: 0, color: "#60A5FA" },
        { label: "Pessoal", value: 0, color: "#355B8C" },
        { label: "Operacional", value: 0, color: "#64748B" },
        { label: "Outros", value: 0, color: "#273A53" }
    ];

    const content = $(".content");
    const sidebar = $("#sidebar");
    const menuToggle = $("#menuToggle");
    const originalContent = content ? [...content.children] : [];

    // Rota prioritária de Receitas: registrada no início para continuar
    // funcionando mesmo se outro módulo falhar durante a inicialização.
    document.addEventListener("click", (event) => {
        const item = event.target.closest('.nav-item[data-page="Receitas"]');
        if (!item) return;

        event.preventDefault();
        event.stopImmediatePropagation();

        setActiveNavigation("Receitas");
        closeSidebar();
        showRevenuePage();
    }, true);

    // --------------------------------------------------
    // FORMATAÇÃO DE DATAS
    // --------------------------------------------------

    function dateLabel(value) {
        if (!value) return "—";

        const [year, month, day] = value.split("-").map(Number);

        return new Intl.DateTimeFormat("pt-BR", {
            day: "2-digit",
            month: "short",
            year: "numeric",
            timeZone: "UTC"
        })
            .format(new Date(Date.UTC(year, month - 1, day)))
            .replace(".", "");
    }

    // --------------------------------------------------
    // ARMAZENAMENTO
    // --------------------------------------------------

    function loadVariableExpenses() {
        try {
            const saved = localStorage.getItem(STORAGE_KEY);
            const parsed = saved ? JSON.parse(saved) : [];

            return Array.isArray(parsed) ? parsed : [];
        } catch (error) {
            console.error("Não foi possível carregar as despesas:", error);
            return [];
        }
    }

    let variableExpenses = loadVariableExpenses();

    function persistVariableExpenses() {
        try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(variableExpenses));
            return true;
        } catch (error) {
            console.error("Não foi possível salvar as despesas:", error);
            showToast("Não foi possível salvar. Verifique o armazenamento do navegador.");
            return false;
        }
    }

    function loadVehicleTrips() {
        try {
            const saved = localStorage.getItem(VEHICLE_TRIPS_STORAGE_KEY);
            const parsed = saved ? JSON.parse(saved) : [];

            return Array.isArray(parsed) ? parsed : [];
        } catch (error) {
            console.error("Não foi possível carregar as viagens:", error);
            return [];
        }
    }

    function persistVehicleTrips() {
        try {
            localStorage.setItem(VEHICLE_TRIPS_STORAGE_KEY, JSON.stringify(vehicleTrips));
            return true;
        } catch (error) {
            console.error("Não foi possível salvar as viagens:", error);
            showToast("Não foi possível salvar a viagem. Verifique o armazenamento do navegador.");
            return false;
        }
    }

    function loadRegisteredVehicles() {
        try {
            const value = JSON.parse(localStorage.getItem(VEHICLES_STORAGE_KEY) || "[]");
            return Array.isArray(value) ? value : [];
        } catch (error) { console.error("Erro ao carregar veículos:", error); return []; }
    }

    function persistRegisteredVehicles() {
        try { localStorage.setItem(VEHICLES_STORAGE_KEY, JSON.stringify(registeredVehicles)); return true; }
        catch (error) { console.error("Erro ao salvar veículos:", error); showToast("Não foi possível salvar os veículos."); return false; }
    }

    function getVehicleByPlate(plate) {
        const key = String(plate || "").toUpperCase().replace(/[^A-Z0-9]/g, "");
        return registeredVehicles.find((v) => String(v.plate || "").toUpperCase().replace(/[^A-Z0-9]/g, "") === key);
    }

    function getVehicleCostOccurrences(month = currentMonth()) {
        return registeredVehicles.flatMap((vehicle) => (vehicle.costs || []).flatMap((cost) => {
            const amount = Math.max(0, Number(cost.amount) || 0);
            const count = cost.paymentMethod === "card" ? Math.max(1, Number(cost.installmentsCount) || 1) : 1;
            const base = cost.paymentMethod === "card" ? (cost.invoiceDueDate || cost.date) : cost.date;
            if (!base) return [];
            if (count === 1) return monthKey(base) === month ? [{ ...cost, vehicleId: vehicle.id, vehiclePlate: vehicle.plate, occurrenceDate: base, occurrenceAmount: amount }] : [];
            return Array.from({length:count}, (_,i) => {
                const date = new Date(base + "T12:00:00");
                date.setMonth(date.getMonth() + i);
                const due = localISO(date);
                return {...cost, vehicleId:vehicle.id, vehiclePlate:vehicle.plate, occurrenceDate:due, occurrenceAmount:amount/count, installmentNumber:i+1};
            }).filter((item) => monthKey(item.occurrenceDate) === month);
        }));
    }

    function getMonthlyVehicleMaintenanceTotal(month = currentMonth()) {
        return getVehicleCostOccurrences(month).reduce((sum, item) => sum + item.occurrenceAmount, 0);
    }

    function showToast(message) {
        const toast = $("#toast");
        if (!toast) return;

        toast.textContent = message;
        toast.hidden = false;

        clearTimeout(toastTimeout);

        toastTimeout = setTimeout(() => {
            toast.hidden = true;
        }, 3200);
    }

    function refreshIcons() {
        if (window.lucide) {
            window.lucide.createIcons();
        }
    }

    // --------------------------------------------------
    // CÁLCULOS FINANCEIROS
    // --------------------------------------------------

    function getMonthTransactions(month = currentMonth()) {
        return transactions.filter((item) => monthKey(item.date) === month);
    }

    function getInstallments() {
        return variableExpenses.flatMap((expense) =>
            (expense.installments || []).map((installment) => ({
                ...installment,
                expenseId: expense.id,
                expenseName: expense.name,
                company: expense.company,
                category: expense.category,
                expenseType: expense.expenseType
            }))
        );
    }

    function getFinalizedTripTotals(month = currentMonth()) {
        return vehicleTrips.filter((trip) => trip.finalizedAt && monthKey(trip.tripDate) === month).reduce((totals, trip) => {
            const data = trip.manifestData || {};
            totals.revenue += Math.max(0, Number(data.totalFreight) || 0);
            totals.expense += Math.max(0, Number(trip.vehiclePay) || 0);
            totals.expense += (Array.isArray(trip.extraCosts) ? trip.extraCosts : []).reduce((sum, cost) => sum + Math.max(0, Number(cost.amount) || 0), 0);
            return totals;
        }, { revenue: 0, expense: 0 });
    }

    function getMonthlyExpenseTotal(month = currentMonth()) {
        const ordinaryExpenses = getMonthTransactions(month).filter((item) => item.type === "expense").reduce((sum, item) => sum + item.amount, 0);
        const registeredExpenses = getInstallments().filter((item) => monthKey(item.date) === month).reduce((sum, item) => sum + item.amount, 0);
        const payrollCost = window.PRIMEPayroll ? window.PRIMEPayroll.getCompetencyCost(month) : 0;
        return ordinaryExpenses + registeredExpenses + getFinalizedTripTotals(month).expense + getMonthlyVehicleMaintenanceTotal(month) + payrollCost;
    }

    function getAllRevenueRecords() {
        try {
            const rows = JSON.parse(localStorage.getItem("primeRevenueDemoV1") || "[]");
            return Array.isArray(rows) ? rows : [];
        } catch (error) {
            console.error("Não foi possível ler as receitas:", error);
            return [];
        }
    }

    function getPaidRevenueRecords() {
        return getAllRevenueRecords().filter((row) => row.payment_status === "recebido");
    }

    function getReceivableRevenueRecords() {
        return getAllRevenueRecords().filter((row) => row.payment_status !== "recebido");
    }

    function getReceivableBalance() {
        return getReceivableRevenueRecords().reduce((sum, row) => {
            const total = Math.max(0, Number(row.total_amount) || 0);
            const received = Math.max(0, Number(row.received_amount) || 0);
            return sum + Math.max(0, total - received);
        }, 0);
    }

    function getForecastReceiptsToday() {
        return getReceivableRevenueRecords()
            .filter((row) => String(row.due_date || row.competency_date || row.service_date || "") === todayISO)
            .reduce((sum, row) => {
                const total = Math.max(0, Number(row.total_amount) || 0);
                const received = Math.max(0, Number(row.received_amount) || 0);
                return sum + Math.max(0, total - received);
            }, 0);
    }

    function getForecastUnpaidExpensesToday() {
        const unpaidInstallments = getInstallments()
            .filter((item) => !item.paid && String(item.date || "") === todayISO)
            .reduce((sum, item) => sum + Math.max(0, Number(item.amount) || 0), 0);
        const todayVehicleCosts = getVehicleCostOccurrences(currentMonth())
            .filter((item) => String(item.occurrenceDate || "") === todayISO);
        const unpaidVehicleInvoices = todayVehicleCosts
            .filter((item) => item.paymentMethod === "card")
            .reduce((sum, item) => sum + Math.max(0, Number(item.occurrenceAmount) || 0), 0);
        const unpaidPayroll = window.PRIMEPayroll && typeof window.PRIMEPayroll.getPendingPaymentsForDate === "function"
            ? window.PRIMEPayroll.getPendingPaymentsForDate(todayISO)
            : 0;
        return unpaidInstallments + unpaidVehicleInvoices + unpaidPayroll;
    }

    function getPaidVehicleCostsToday() {
        return getVehicleCostOccurrences(currentMonth())
            .filter((item) => String(item.occurrenceDate || "") === todayISO && item.paymentMethod !== "card")
            .reduce((sum, item) => sum + Math.max(0, Number(item.occurrenceAmount) || 0), 0);
    }

    function getProjectedDailyBalance() {
        // O saldo efetivo já inclui os recebimentos e pagamentos realmente registrados.
        // Somente compromissos ainda pendentes de hoje são adicionados à projeção.
        return getCashBalance() + getForecastReceiptsToday()
            - getForecastUnpaidExpensesToday() - getPaidVehicleCostsToday();
    }

    function getMonthlyRevenueTotal(month = currentMonth()) {
        const ordinaryRevenue = getMonthTransactions(month).filter((item) => item.type === "revenue").reduce((sum, item) => sum + item.amount, 0);
        const receivedRevenue = getPaidRevenueRecords().filter((item) => monthKey(item.payment_date) === month).reduce((sum, item) => sum + (Number(item.received_amount ?? item.total_amount) || 0), 0);
        return ordinaryRevenue + receivedRevenue + getFinalizedTripTotals(month).revenue;
    }

    function getTotals(items) {
        return items.reduce((totals, item) => {
            if (item.type === "revenue") {
                totals.revenue += item.amount;
            } else {
                totals.expense += item.amount;
            }

            return totals;
        }, { revenue: 0, expense: 0 });
    }

    function getCashBalance() {
        // O saldo efetivo não deve incorporar lançamentos datados no futuro.
        const ordinaryTotals = getTotals(transactions.filter((item) => !item.date || item.date <= todayISO));

        const paidInstallments = getInstallments()
            .filter((item) => item.paid && String(item.paidAt || item.date || "").slice(0, 10) <= todayISO)
            .reduce((sum, item) => sum + item.amount, 0);

        const finalizedTrips = vehicleTrips.filter((trip) => {
            if (!trip.finalizedAt) return false;
            return String(trip.finalizedAt || trip.tripDate || "").slice(0, 10) <= todayISO;
        }).reduce((totals, trip) => {
            totals.revenue += Math.max(0, Number(trip.manifestData?.totalFreight) || 0);
            totals.expense += Math.max(0, Number(trip.vehiclePay) || 0);
            totals.expense += (Array.isArray(trip.extraCosts) ? trip.extraCosts : []).reduce((sum, cost) => sum + Math.max(0, Number(cost.amount) || 0), 0);
            return totals;
        }, { revenue: 0, expense: 0 });
        const paidPayroll = window.PRIMEPayroll && typeof window.PRIMEPayroll.getPaidPaymentsThroughDate === "function"
            ? window.PRIMEPayroll.getPaidPaymentsThroughDate(todayISO)
            : (window.PRIMEPayroll ? window.PRIMEPayroll.getPaidPaymentsTotal() : 0);
        const receivedRevenue = getPaidRevenueRecords()
            .filter((item) => !item.payment_date || String(item.payment_date).slice(0, 10) <= todayISO)
            .reduce((sum, item) => sum + (Number(item.received_amount ?? item.total_amount) || 0), 0);
        return ordinaryTotals.revenue + receivedRevenue - ordinaryTotals.expense - paidInstallments - paidPayroll + finalizedTrips.revenue - finalizedTrips.expense;
    }

    function getExpenseCategories() {
        const categories = categoryData.map((category) => ({
            ...category,
            value: 0
        }));

        const currentExpenses = [
            ...getMonthTransactions().filter((item) => item.type === "expense"),
            ...getInstallments()
                .filter((item) => monthKey(item.date) === currentMonth())
                .map((item) => ({ amount: item.amount, category: item.category || "Outros" })),
            ...getVehicleCostOccurrences(currentMonth()).map((item) => ({ amount: item.occurrenceAmount, category: "Manutenção" })),
            ...(window.PRIMEPayroll && window.PRIMEPayroll.getCompetencyCost(currentMonth()) > 0 ? [{ amount: window.PRIMEPayroll.getCompetencyCost(currentMonth()), category: "Pessoal" }] : [])
        ];

        currentExpenses.forEach((expense) => {
            const category = categories.find(
                (item) => item.label === expense.category
            );

            const destination = category || categories.find(
                (item) => item.label === "Outros"
            );

            if (destination) {
                destination.value += expense.amount;
            }
        });

        return categories;
    }

    // --------------------------------------------------
    // DASHBOARD
    // --------------------------------------------------

    function updateDashboard() {
        const revenue = getMonthlyRevenueTotal();
        const expense = getMonthlyExpenseTotal();
        const result = getProjectedDailyBalance();
        const receivableRecords = getReceivableRevenueRecords();
        const receivableBalance = getReceivableBalance();

        if ($("#balanceValue")) {
            $("#balanceValue").textContent = money(getCashBalance());
        }

        if ($("#receivableValue")) {
            $("#receivableValue").textContent = money(receivableBalance);
        }

        if ($("#expenseValue")) {
            $("#expenseValue").textContent = money(expense);
        }

        if ($("#resultValue")) {
            $("#resultValue").textContent = money(result);
        }

        const monthlyTransactions = getMonthTransactions();
        const expenseCount =
            monthlyTransactions.filter((item) => item.type === "expense").length +
            getInstallments().filter((item) => monthKey(item.date) === currentMonth()).length +
            vehicleTrips.filter((trip) => trip.finalizedAt && monthKey(trip.tripDate) === currentMonth()).length +
            getVehicleCostOccurrences(currentMonth()).length +
            (window.PRIMEPayroll && window.PRIMEPayroll.getCompetencyCost(currentMonth()) > 0 ? 1 : 0);

        const balanceStatus = $(".kpi-card:nth-child(1) .kpi-bottom");
        const receivableStatus = $(".kpi-card:nth-child(2) .kpi-bottom");
        const expenseStatus = $(".kpi-card:nth-child(3) .kpi-bottom");
        const resultStatus = $(".kpi-card:nth-child(4) .kpi-bottom");

        if (balanceStatus) {
            balanceStatus.innerHTML = `
                <span class="status-neutral">
                    <i data-lucide="minus"></i>
                    ${transactions.length || getInstallments().some((item) => item.paid) || getPaidRevenueRecords().length
                    ? "Movimentações registradas"
                    : "Sem movimentações"}
                </span>
                <span class="muted">Saldo efetivo</span>
            `;
        }

        if (receivableStatus) {
            receivableStatus.innerHTML = `
                <span class="status-neutral">
                    <i data-lucide="minus"></i>
                    ${receivableRecords.length ? `${receivableRecords.length} fatura(s) pendente(s)` : "Nenhuma fatura pendente"}
                </span>
                <span class="muted">Em aberto e vencidas</span>
            `;
        }

        if (expenseStatus) {
            expenseStatus.innerHTML = `
                <span class="status-neutral">
                    <i data-lucide="minus"></i>
                    ${expenseCount ? `${expenseCount} compromisso(s)` : "Sem registros"}
                </span>
                <span class="muted">Mês atual</span>
            `;
        }

        if (resultStatus) {
            resultStatus.innerHTML = `
                <span class="status-neutral">
                    <i data-lucide="minus"></i>
                    ${revenue !== 0 || expense !== 0 ? "Projeção de caixa" : "Aguardando lançamentos"}
                </span>
                <span class="muted">Previsão de fechamento de hoje</span>
            `;
        }

        if ($("#chartRevenueTotal")) {
            $("#chartRevenueTotal").textContent = money(revenue);
        }

        if ($("#chartExpenseTotal")) {
            $("#chartExpenseTotal").textContent = money(expense);
        }

        if ($("#categoryTotal")) {
            $("#categoryTotal").textContent = money(expense);
        }

        renderBillsTable();
        updateCharts();
        renderTransactions();
        buildCategoryLegend();
        refreshIcons();
    }

    // --------------------------------------------------
    // FLUXO DE CAIXA
    // --------------------------------------------------

    function getCashflowData(monthCount) {
        const months = [];
        const now = new Date();

        for (let offset = monthCount - 1; offset >= 0; offset--) {
            const date = new Date(
                now.getFullYear(),
                now.getMonth() - offset,
                1
            );

            const key = `${date.getFullYear()}-${String(
                date.getMonth() + 1
            ).padStart(2, "0")}`;

            months.push({
                key,
                label: new Intl.DateTimeFormat("pt-BR", {
                    month: "short"
                }).format(date).replace(".", ""),
                revenue: getMonthlyRevenueTotal(key),
                expense: getMonthlyExpenseTotal(key)
            });
        }

        return months;
    }

    function initCashflowChart(monthCount = 6) {
        const canvas = $("#cashflowChart");
        if (!canvas || !window.Chart) return;

        if (cashflowChart) {
            cashflowChart.destroy();
        }

        const months = getCashflowData(monthCount);

        cashflowChart = new Chart(canvas, {
            type: "bar",
            data: {
                labels: months.map((month) => month.label),
                datasets: [
                    {
                        label: "Receitas",
                        data: months.map((month) => month.revenue),
                        backgroundColor: "#3B82F6",
                        hoverBackgroundColor: "#60A5FA",
                        borderRadius: 3,
                        borderSkipped: false,
                        maxBarThickness: 17
                    },
                    {
                        label: "Despesas",
                        data: months.map((month) => month.expense),
                        backgroundColor: "#344E70",
                        hoverBackgroundColor: "#496B96",
                        borderRadius: 3,
                        borderSkipped: false,
                        maxBarThickness: 17
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                interaction: {
                    intersect: false,
                    mode: "index"
                },
                plugins: {
                    legend: { display: false },
                    tooltip: {
                        backgroundColor: "#101D30",
                        titleColor: "#F1F5F9",
                        bodyColor: "#CBD5E1",
                        borderColor: "#2B405C",
                        borderWidth: 1,
                        padding: 10,
                        callbacks: {
                            label(context) {
                                return `${context.dataset.label}: ${money(context.raw)}`;
                            }
                        }
                    }
                },
                scales: {
                    x: {
                        grid: { display: false },
                        border: { display: false },
                        ticks: {
                            color: "#8393A9",
                            font: { family: "Montserrat", size: 9 },
                            padding: 9
                        }
                    },
                    y: {
                        beginAtZero: true,
                        border: { display: false },
                        grid: {
                            color: "#1A293C",
                            drawTicks: false
                        },
                        ticks: {
                            color: "#8393A9",
                            font: { family: "Montserrat", size: 9 },
                            padding: 10,
                            maxTicksLimit: 5,
                            callback(value) {
                                return `R$ ${Number(value / 1000).toLocaleString("pt-BR")} mil`;
                            }
                        }
                    }
                }
            }
        });
    }

    // --------------------------------------------------
    // GRÁFICO DE CATEGORIAS
    // --------------------------------------------------

    function buildCategoryLegend() {
        const legend = $("#categoryLegend");
        if (!legend) return;

        const categories = getExpenseCategories();
        const total = categories.reduce((sum, item) => sum + item.value, 0);

        if (total === 0) {
            legend.innerHTML = `
                <div class="empty-state">
                    Nenhuma despesa registrada neste mês.
                </div>
            `;
            return;
        }

        legend.innerHTML = categories
            .filter((item) => item.value > 0)
            .map((item) => `
                <div class="category-item">
                    <span class="category-color" style="background:${item.color}"></span>
                    <span>${escapeHTML(item.label)}</span>
                    <strong>${Math.round((item.value / total) * 100)}%</strong>
                </div>
            `).join("");
    }

    function initExpensesChart() {
        const canvas = $("#expensesChart");
        if (!canvas || !window.Chart) return;

        if (expensesChart) {
            expensesChart.destroy();
        }

        const categories = getExpenseCategories();
        const total = categories.reduce((sum, item) => sum + item.value, 0);

        expensesChart = new Chart(canvas, {
            type: "doughnut",
            data: {
                labels: categories.map((item) => item.label),
                datasets: [{
                    data: categories.map((item) => item.value),
                    backgroundColor: categories.map((item) => item.color),
                    borderColor: "#0A1321",
                    borderWidth: 4,
                    hoverOffset: 3
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                cutout: "75%",
                plugins: {
                    legend: { display: false },
                    tooltip: {
                        enabled: total > 0,
                        backgroundColor: "#101D30",
                        titleColor: "#F1F5F9",
                        bodyColor: "#CBD5E1",
                        borderColor: "#2B405C",
                        borderWidth: 1,
                        padding: 10,
                        callbacks: {
                            label(context) {
                                return `${context.label}: ${money(context.raw)}`;
                            }
                        }
                    }
                }
            }
        });
    }

    window.addEventListener("prime:revenues-updated", () => { updateDashboard(); });

    function updateCharts() {
        const period = $("#cashflowPeriod");
        initCashflowChart(period ? Number(period.value) : 6);
        initExpensesChart();
    }

    // --------------------------------------------------
    // TRANSAÇÕES RECENTES
    // --------------------------------------------------

    function renderTransactions() {
        const list = $("#transactionList");
        if (!list) return;

        const query = $("#globalSearch")
            ? $("#globalSearch").value.trim().toLocaleLowerCase("pt-BR")
            : "";

        const revenueTransactions = getPaidRevenueRecords().map((item) => ({
            description: item.description || ("Receita " + item.reference),
            type: "revenue", category: item.category || "Frete",
            amount: Number(item.received_amount ?? item.total_amount) || 0,
            date: item.payment_date, reference: item.reference, customer_name: item.customer_name
        }));
        const allTransactions = [...transactions, ...revenueTransactions];
        const filtered = allTransactions.filter((item) => {
            const searchable = [item.description, item.customer_name || "", item.reference || "", item.type === "revenue" ? "receita" : "despesa", item.category || ""].join(" ").toLocaleLowerCase("pt-BR");
            return searchable.includes(query);
        });

        if (filtered.length === 0) {
            list.innerHTML = `
                <div class="empty-state">
                    ${query
                    ? "Nenhuma movimentação encontrada."
                    : "Nenhuma movimentação registrada."}
                </div>
            `;
            return;
        }

        list.innerHTML = "";

        [...filtered].reverse().forEach((item) => {
            const row = document.createElement("div");
            row.className = "transaction-row";

            const avatar = document.createElement("span");
            avatar.className = `transaction-avatar ${item.type === "revenue" ? "incoming" : "outgoing"}`;

            const icon = document.createElement("i");
            icon.setAttribute(
                "data-lucide",
                item.type === "revenue" ? "arrow-down-left" : "arrow-up-right"
            );

            avatar.append(icon);

            const details = document.createElement("div");
            details.className = "transaction-details";

            const title = document.createElement("strong");
            title.textContent = item.description;

            const subtitle = document.createElement("span");
            subtitle.textContent = `${dateLabel(item.date)} · ${item.type === "revenue" ? "Receita" : "Despesa"}`;

            details.append(title, subtitle);

            const amount = document.createElement("div");
            amount.className = `transaction-amount ${item.type === "revenue" ? "incoming-amount" : "outgoing-amount"}`;

            amount.textContent = `${item.type === "revenue" ? "+" : "−"} ${money(item.amount)}`;

            row.append(avatar, details, amount);
            list.append(row);
        });

        refreshIcons();
    }

    // --------------------------------------------------
    // CONTAS A PAGAR
    // --------------------------------------------------

    function renderBillsTable() {
        const tbody = $("#billsTable");
        if (!tbody) return;

        const installments = getInstallments()
            .filter((item) => !item.paid)
            .sort((a, b) => (a.date || "").localeCompare(b.date || ""))
            .slice(0, 6);

        if (installments.length === 0) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="4" class="empty-state">
                        Nenhuma conta a pagar cadastrada.
                    </td>
                </tr>
            `;
            return;
        }

        tbody.innerHTML = installments.map((item) => {
            const overdue = Boolean(item.date && item.date < todayISO);

            return `
                <tr>
                    <td>
                        <div class="transaction-name">
                            <span class="table-icon">
                                <i data-lucide="receipt-text"></i>
                            </span>
                            <span>
                                <strong>${escapeHTML(item.expenseName)}</strong>
                                <small>${escapeHTML(item.company || "Fornecedor não informado")}</small>
                            </span>
                        </div>
                    </td>
                    <td>${dateLabel(item.date)}</td>
                    <td>
                        <span class="badge ${overdue ? "badge-overdue" : "badge-pending"}">
                            ${overdue ? "Atrasado" : "Pendente"}
                        </span>
                    </td>
                    <td class="align-right money-value">${money(item.amount)}</td>
                </tr>
            `;
        }).join("");

        refreshIcons();
    }

    // --------------------------------------------------
    // NAVEGAÇÃO
    // --------------------------------------------------

    function setActiveNavigation(pageName) {
        $$(".nav-item").forEach((item) => {
            item.classList.toggle("active", item.dataset.page === pageName);
        });
    }

    function closeSidebar() {
        if (!sidebar || !menuToggle) return;

        sidebar.classList.remove("open");
        menuToggle.setAttribute("aria-expanded", "false");
    }

    function restoreDashboardContent() {
        if (expensesPage) {
            expensesPage.hidden = true;
        }
        if (revenuePage) {
            revenuePage.hidden = true;
        }

        originalContent.forEach((element) => {
            element.hidden = false;
        });
    }

    function showDashboard() {
        restoreDashboardContent();

        if ($("#currentPage")) {
            $("#currentPage").textContent = "Dashboard";
        }

        $("#dashboard")?.scrollIntoView({
            behavior: "smooth",
            block: "start"
        });
    }

    function showRevenuePage() {
        if (!content) {
            console.error("[PRIME Receitas] Não foi encontrado o contêiner .content.");
            showToast("Não foi possível abrir Receitas: área principal não encontrada.");
            return;
        }

        if (!revenuePage) {
            revenuePage = document.createElement("section");
            revenuePage.id = "revenuePage";
            revenuePage.hidden = true;
            revenuePage.setAttribute("aria-live", "polite");
            content.appendChild(revenuePage);
        }

        originalContent.forEach((element) => { element.hidden = true; });
        if (expensesPage) expensesPage.hidden = true;
        revenuePage.hidden = false;

        if ($("#currentPage")) $("#currentPage").textContent = "Receitas";
        window.scrollTo({ top: 0, behavior: "smooth" });

        if (!window.PRIMERevenue || typeof window.PRIMERevenue.render !== "function") {
            console.error("[PRIME Receitas] revenue.js não disponibilizou PRIMERevenue.render.");
            revenuePage.innerHTML = `
                <div class="expenses-page-header">
                    <div class="eyebrow">GESTÃO FINANCEIRA / FATURAMENTO</div>
                    <h1>Receitas<span class="blue-period">.</span></h1>
                    <p>O módulo de receitas foi solicitado, mas o arquivo revenue.js não foi inicializado.</p>
                    <p style="margin-top:12px;color:#FCA5A5">Atualize a página com ⌘ + Shift + R. Se o problema continuar, verifique o carregamento de revenue.js.</p>
                </div>`;
            showToast("A tela Receitas abriu, mas o módulo não foi inicializado.");
            return;
        }

        try {
            window.PRIMERevenue.render(revenuePage);
        } catch (error) {
            console.error("[PRIME Receitas] Erro ao renderizar a tela:", error);
            revenuePage.innerHTML = `
                <div class="expenses-page-header">
                    <div class="eyebrow">GESTÃO FINANCEIRA / FATURAMENTO</div>
                    <h1>Receitas<span class="blue-period">.</span></h1>
                    <p>Ocorreu um erro ao montar a tela de receitas.</p>
                    <p style="margin-top:12px;color:#FCA5A5">${String(error && error.message ? error.message : error)}</p>
                </div>`;
            showToast("Receitas abriu com um erro. A mensagem está visível na tela.");
        }
    }

    // --------------------------------------------------
    // DESPESAS: PÁGINAS
    // --------------------------------------------------

    function renderExpensesHome() {
        if (!expensesPage) return;

        expensesPage.innerHTML = `
            <div class="expenses-page-header">
                <div class="eyebrow">GESTÃO FINANCEIRA</div>
                <h1>Despesas<span class="blue-period">.</span></h1>
                <p>Selecione uma área para consultar e organizar as despesas da operação.</p>
            </div>

            <div class="expenses-options">
                <button type="button" class="expenses-option" data-expense-section="matriz">
                    <span class="expenses-option-icon"><i data-lucide="house"></i></span>
                    <span class="expenses-option-copy">
                        <strong>Matriz</strong>
                        <span>Despesas administrativas, estrutura, contas e custos da matriz.</span>
                    </span>
                    <i data-lucide="arrow-up-right" class="expenses-option-arrow"></i>
                </button>

                <button type="button" class="expenses-option" data-expense-section="veiculos">
                    <span class="expenses-option-icon"><i data-lucide="car-front"></i></span>
                    <span class="expenses-option-copy">
                        <strong>Veículos</strong>
                        <span>Combustível, manutenção, documentos e demais custos dos veículos.</span>
                    </span>
                    <i data-lucide="arrow-up-right" class="expenses-option-arrow"></i>
                </button>
            </div>
        `;

        bindExpenseButtons();
        refreshIcons();
    }

    function renderMatrixOptions() {
        if (!expensesPage) return;

        expensesPage.innerHTML = `
            <div class="expenses-page-header">
                <div class="eyebrow">GESTÃO FINANCEIRA / MATRIZ</div>
                <h1>Matriz<span class="blue-period">.</span></h1>
                <p>Escolha o grupo de despesas que deseja acessar.</p>

                <button type="button" class="button-secondary"
                    data-expense-action="back" style="margin-top:16px">
                    <i data-lucide="arrow-left"></i> Voltar para Despesas
                </button>
            </div>

            <div class="expenses-options">
                <button type="button" class="expenses-option" data-expense-section="variaveis">
                    <span class="expenses-option-icon"><i data-lucide="receipt-text"></i></span>
                    <span class="expenses-option-copy">
                        <strong>Despesas variáveis</strong>
                        <span>Registre e organize os custos da operação da matriz.</span>
                    </span>
                    <i data-lucide="arrow-up-right" class="expenses-option-arrow"></i>
                </button>

                <button type="button" class="expenses-option" data-expense-section="folha">
                    <span class="expenses-option-icon"><i data-lucide="book-open"></i></span>
                    <span class="expenses-option-copy">
                        <strong>Folha</strong>
                        <span>Área destinada ao controle da folha e dos custos com pessoal.</span>
                    </span>
                    <i data-lucide="arrow-up-right" class="expenses-option-arrow"></i>
                </button>
            </div>
        `;

        bindExpenseButtons();
        refreshIcons();
    }

    function renderVehicleOptions() {
        if (!expensesPage) return;

        expensesPage.innerHTML = `
            <div class="expenses-page-header">
                <div class="eyebrow">GESTÃO FINANCEIRA / VEÍCULOS</div>
                <h1>Veículos<span class="blue-period">.</span></h1>
                <p>Selecione o tipo de despesa que deseja consultar ou organizar.</p>

                <button type="button" class="button-secondary"
                    data-expense-action="back" style="margin-top:16px">
                    <i data-lucide="arrow-left"></i> Voltar para Despesas
                </button>
            </div>

            <div class="expenses-options">
                <button type="button" class="expenses-option" data-expense-section="despesa-viagem">
                    <span class="expenses-option-icon"><i data-lucide="route"></i></span>
                    <span class="expenses-option-copy">
                        <strong>Despesa de viagem</strong>
                        <span>Combustível, diárias, descargas e demais custos relacionados às viagens.</span>
                    </span>
                    <i data-lucide="arrow-up-right" class="expenses-option-arrow"></i>
                </button>

                <button type="button" class="expenses-option" data-expense-section="despesa-manutencao">
                    <span class="expenses-option-icon"><i data-lucide="wrench"></i></span>
                    <span class="expenses-option-copy">
                        <strong>FROTA</strong>
                        <span>Manutenções preventivas, corretivas, peças, serviços e reparos dos veículos.</span>
                    </span>
                    <i data-lucide="arrow-up-right" class="expenses-option-arrow"></i>
                </button>
            </div>
        `;

        bindExpenseButtons();
        refreshIcons();
    }


    // --------------------------------------------------
    // CADASTRO E GESTÃO DA FROTA
    // --------------------------------------------------
    function getVehicleTripStats(vehicle) {
        const plate = String(vehicle.plate || "").toUpperCase().replace(/[^A-Z0-9]/g, "");
        const trips = vehicleTrips.filter(t => t.finalizedAt && String(t.plate || "").toUpperCase().replace(/[^A-Z0-9]/g, "") === plate);
        const kms = trips.map(t => t.startKm !== null && t.startKm !== "" && t.returnKm !== null && t.returnKm !== "" ? Math.max(0, Number(t.returnKm) - Number(t.startKm)) : 0).filter(k => k > 0);
        const totalKm = kms.reduce((s,k)=>s+k,0);
        const cost = trips.reduce((s,t)=>s+Math.max(0,Number(t.vehiclePay)||0)+(t.extraCosts||[]).reduce((a,c)=>a+Math.max(0,Number(c.amount)||0),0),0);
        const revenue = trips.reduce((s,t)=>s+Math.max(0,Number(t.manifestData?.totalFreight)||0),0);
        return {trips:trips.length,totalKm,averageKm:kms.length?totalKm/kms.length:0,averageCostPerKm:totalKm?cost/totalKm:0,averageRevenuePerKm:totalKm?revenue/totalKm:0};
    }

    function renderVehicleMaintenancePage(vehicleId = null, showVehicleForm = false, showCostForm = false, editingVehicleId = null) {
        if (!expensesPage) return;
        const editingVehicle = editingVehicleId ? registeredVehicles.find(v => String(v.id) === String(editingVehicleId)) : null;
        const vehicle = vehicleId ? registeredVehicles.find(v => String(v.id) === String(vehicleId)) : null;
        const types = ["Carro","Fiorino","Van","3/4","Truck","Cavalo","Carreta"];
        const fuels = ["Diesel","Gasolina","Etanol","Flex","GNV","Elétrico","Outro"];
        if (vehicle) {
            const stats = getVehicleTripStats(vehicle);
            const costs = [...(vehicle.costs||[])].sort((a,b)=>String(b.date||"").localeCompare(String(a.date||"")));
            expensesPage.innerHTML = `
              <div class="expenses-page-header"><div class="eyebrow">GESTÃO FINANCEIRA / FROTA</div><h1>${escapeHTML(vehicle.plate)}<span class="blue-period">.</span></h1><p>Quilometragem, médias operacionais e histórico de despesas.</p><div class="vehicle-trips-toolbar"><button class="button-secondary" data-expense-action="back-maintenance" type="button"><i data-lucide="arrow-left"></i> Voltar para frota</button><button class="button-secondary" data-vehicle-action="edit-vehicle" type="button"><i data-lucide="pencil"></i> Alterar dados</button><button class="button-secondary" data-vehicle-action="delete-vehicle" type="button"><i data-lucide="trash-2"></i> Excluir veículo</button><button class="button-primary" data-vehicle-action="add-cost" type="button"><i data-lucide="plus"></i> Add custo do veículo</button></div></div>
              <section class="vehicle-trip-details-panel"><div class="vehicle-trip-details-heading"><div><span class="vehicle-trip-detail-kicker">DADOS DO VEÍCULO</span><h2>${escapeHTML(vehicle.type)} • ${escapeHTML(vehicle.year)}</h2><p>Placa: ${escapeHTML(vehicle.plate)} <span>•</span> Combustível: ${escapeHTML(vehicle.fuelType)}</p></div><span class="vehicle-trip-details-file"><i data-lucide="gauge"></i> KM atual: ${Number(vehicle.currentKm||0).toLocaleString("pt-BR")}</span></div>
              <div class="vehicle-trip-metrics">
                <article class="vehicle-trip-metric"><span>VIAGENS FINALIZADAS</span><strong>${stats.trips}</strong></article>
                <article class="vehicle-trip-metric"><span>KM RODADOS</span><strong>${stats.totalKm.toLocaleString("pt-BR")} km</strong></article>
                <article class="vehicle-trip-metric"><span>MÉDIA KM / VIAGEM</span><strong>${stats.averageKm?Math.round(stats.averageKm).toLocaleString("pt-BR")+" km":"—"}</strong></article>
                <article class="vehicle-trip-metric"><span>CUSTO MÉDIO / KM</span><strong>${stats.averageCostPerKm?money(stats.averageCostPerKm):"—"}</strong></article>
                <article class="vehicle-trip-metric"><span>RECEITA MÉDIA / KM</span><strong>${stats.averageRevenuePerKm?money(stats.averageRevenuePerKm):"—"}</strong></article>
              </div>
              ${showCostForm ? `<form id="vehicleMaintenanceCostForm" class="vehicle-trip-extra-form"><h3>Cadastro de despesa do veículo</h3><div class="vehicle-maintenance-form-grid">
                <label class="form-field">Tipo de despesa<select name="category" required><option>Manutenção</option><option>Troca de pneus</option><option>Óleo e lubrificantes</option><option>Peças</option><option>Documentos</option><option>Lavagem</option><option>Outro</option></select></label>
                <label class="form-field">Descrição<input name="description" maxlength="160" required placeholder="Ex.: troca de dois pneus"></label>
                <label class="form-field">Valor total (R$)<input name="amount" type="number" min="0.01" step="0.01" required placeholder="0,00"></label>
                <label class="form-field">Data da despesa<input name="date" type="date" value="${todayISO}" required></label>
                <label class="form-field">Forma de pagamento<select name="paymentMethod" required><option value="cash">À vista</option><option value="card">Cartão de crédito</option></select></label>
                <label class="form-field">Quantidade de parcelas<select name="installmentsCount"><option value="1">1 parcela</option><option value="2">2 parcelas</option><option value="3">3 parcelas</option><option value="4">4 parcelas</option><option value="5">5 parcelas</option><option value="6">6 parcelas</option><option value="7">7 parcelas</option><option value="8">8 parcelas</option><option value="9">9 parcelas</option><option value="10">10 parcelas</option><option value="11">11 parcelas</option><option value="12">12 parcelas</option></select></label>
                <label class="form-field vehicle-invoice-due-field" hidden>Vencimento da primeira fatura<input name="invoiceDueDate" type="date" value="${todayISO}"></label></div>
                <p class="form-note">À vista: entra no mês da data da despesa. Cartão: o valor é dividido pelas parcelas a partir do vencimento da primeira fatura.</p><div class="vehicle-trip-form-actions"><button type="button" class="button-secondary" data-vehicle-action="cancel-cost">Cancelar</button><button type="submit" class="button-primary"><i data-lucide="save"></i> Salvar despesa</button></div></form>` : ""}
              <section class="vehicle-trip-detail-section"><div class="vehicle-trip-table-heading"><div><h3><i data-lucide="receipt-text"></i> Histórico de despesas</h3><p>Manutenção, pneus, óleo, peças, documentos e outros custos.</p></div></div>
              ${costs.length ? '<div class="vehicle-trip-cost-list">'+costs.map(c=>'<article class="vehicle-trip-cost-row"><div><strong>'+escapeHTML(c.category||"Despesa")+' — '+escapeHTML(c.description||"")+'</strong><span>'+dateLabel(c.date)+' • '+(c.paymentMethod==="card"?"Cartão • "+(c.installmentsCount||1)+"x • 1ª fatura "+dateLabel(c.invoiceDueDate||c.date):"À vista")+'</span></div><strong>'+money(c.amount)+'</strong><button type="button" class="button-secondary" data-vehicle-cost-delete="'+escapeHTML(c.id)+'" aria-label="Excluir despesa"><i data-lucide="trash-2"></i></button></article>').join("")+'</div>':'<p class="vehicle-trip-no-data">Nenhuma despesa cadastrada para este veículo.</p>'}</section></section>`;
            bindExpenseButtons();
            expensesPage.querySelector('[data-expense-action="back-maintenance"]')?.addEventListener("click",()=>renderVehicleMaintenancePage());
            expensesPage.querySelector('[data-vehicle-action="edit-vehicle"]')?.addEventListener("click",()=>renderVehicleMaintenancePage(null,true,false,vehicle.id));
            expensesPage.querySelector('[data-vehicle-action="delete-vehicle"]')?.addEventListener("click",()=>{ if(!window.confirm(`Excluir o veículo ${vehicle.plate}? As despesas cadastradas nele também serão removidas. O histórico das viagens já registradas será mantido.`)) return; const old=registeredVehicles; registeredVehicles=old.filter(v=>String(v.id)!==String(vehicle.id)); if(!persistRegisteredVehicles()){registeredVehicles=old;return;} updateDashboard(); showToast("Veículo excluído da frota."); renderVehicleMaintenancePage(); });
            expensesPage.querySelector('[data-vehicle-action="add-cost"]')?.addEventListener("click",()=>renderVehicleMaintenancePage(vehicle.id,false,true));
            expensesPage.querySelector('[data-vehicle-action="cancel-cost"]')?.addEventListener("click",()=>renderVehicleMaintenancePage(vehicle.id));
            const form=$("#vehicleMaintenanceCostForm",expensesPage);
            if(form){
                const payment=form.elements.paymentMethod, count=form.elements.installmentsCount, due=$(".vehicle-invoice-due-field",form);
                const sync=()=>{const card=payment.value==="card";due.hidden=!card;form.elements.invoiceDueDate.required=card;count.disabled=!card;if(!card)count.value="1";};
                payment.addEventListener("change",sync);sync();
                form.addEventListener("submit",event=>{
                    event.preventDefault();const fd=new FormData(form), amount=Number(fd.get("amount")), method=String(fd.get("paymentMethod")), date=String(fd.get("date")||""), invoiceDueDate=method==="card"?String(fd.get("invoiceDueDate")||""):"", installmentsCount=method==="card"?Math.max(1,Number(fd.get("installmentsCount"))||1):1;
                    if(!(amount>0)||!date||(method==="card"&&!invoiceDueDate)){showToast("Informe valor, data e vencimento da fatura para compras no cartão.");return;}
                    const cost={id:`${Date.now()}-${Math.random().toString(36).slice(2,8)}`,category:String(fd.get("category")||"Manutenção"),description:String(fd.get("description")||"").trim(),amount,date,paymentMethod:method,installmentsCount,invoiceDueDate,createdAt:new Date().toISOString()};
                    vehicle.costs=vehicle.costs||[];vehicle.costs.push(cost);
                    if(!persistRegisteredVehicles()){vehicle.costs=vehicle.costs.filter(c=>c.id!==cost.id);return;}
                    updateDashboard();showToast("Despesa cadastrada e dashboard atualizado.");renderVehicleMaintenancePage(vehicle.id);
                });
            }
            expensesPage.querySelectorAll("[data-vehicle-cost-delete]").forEach(button=>button.addEventListener("click",()=>{
                if(!window.confirm("Excluir esta despesa do veículo?"))return;
                const old=vehicle.costs||[];vehicle.costs=old.filter(c=>String(c.id)!==String(button.dataset.vehicleCostDelete));
                if(!persistRegisteredVehicles()){vehicle.costs=old;return;}
                updateDashboard();showToast("Despesa excluída.");renderVehicleMaintenancePage(vehicle.id);
            }));
            refreshIcons();return;
        }
        const list=[...registeredVehicles].sort((a,b)=>String(a.plate||"").localeCompare(String(b.plate||"")));
        expensesPage.innerHTML=`
          <div class="expenses-page-header"><div class="eyebrow">GESTÃO FINANCEIRA / FROTA</div><h1>FROTA<span class="blue-period">.</span></h1><p>Cadastre os veículos, acompanhe o KM e controle os custos de cada um.</p><div class="vehicle-trips-toolbar"><button type="button" class="button-secondary" data-expense-action="back-vehicles"><i data-lucide="arrow-left"></i> Voltar para Veículos</button><button type="button" class="button-primary" data-vehicle-action="new"><i data-lucide="plus"></i> Cadastrar veículo</button></div></div>
          ${showVehicleForm?`<section class="vehicle-trip-form-panel"><div class="vehicle-trip-panel-heading"><div><h2>Novo veículo</h2><p>Informe os dados básicos para acompanhar viagens e despesas.</p></div></div><form id="registeredVehicleForm" class="vehicle-trip-form">
            <label class="form-field">Placa<input name="plate" maxlength="8" placeholder="ABC1D23" required autocomplete="off"></label>
            <label class="form-field">Ano<input name="year" type="number" min="1950" max="2100" required placeholder="2022"></label>
            <label class="form-field">Tipo de vínculo / veículo<select name="type" required><option value="">Selecione</option>${types.map(t=>'<option>'+t+'</option>').join("")}</select></label>
            <label class="form-field">Tipo de combustível<select name="fuelType" required><option value="">Selecione</option>${fuels.map(t=>'<option>'+t+'</option>').join("")}</select></label>
            <label class="form-field">KM atual<input name="currentKm" type="number" min="0" step="1" required placeholder="Ex.: 125000"></label>
            <div class="vehicle-trip-form-actions"><button type="button" class="button-secondary" data-vehicle-action="cancel-new">Cancelar</button><button type="submit" class="button-primary"><i data-lucide="save"></i> Salvar veículo</button></div>
          </form></section>`:""}
          <section class="vehicle-trips-list-panel"><div class="vehicle-trip-panel-heading"><div><h2>Veículos cadastrados</h2><p>Selecione um veículo para consultar médias e registrar despesas.</p></div><span class="vehicle-trips-count">${list.length} veículo(s)</span></div>
          ${list.length?'<div class="vehicle-trips-list">'+list.map(v=>{const s=getVehicleTripStats(v);return '<article class="vehicle-trip-card"><div class="vehicle-trip-card-icon"><i data-lucide="truck"></i></div><div class="vehicle-trip-card-main"><strong>'+escapeHTML(v.plate)+' • '+escapeHTML(v.type)+'</strong><span>Ano: '+escapeHTML(v.year)+' • '+escapeHTML(v.fuelType)+'</span><span>KM atual: '+Number(v.currentKm||0).toLocaleString("pt-BR")+'</span><span>'+s.trips+' viagem(ns) finalizada(s) • média '+(s.averageKm?Math.round(s.averageKm).toLocaleString("pt-BR")+" km/viagem":"sem média ainda")+'</span></div><button type="button" class="button-secondary vehicle-trip-view-button" data-vehicle-view="'+escapeHTML(v.id)+'"><i data-lucide="eye"></i> VER</button></article>';}).join("")+'</div>':'<div class="vehicle-trips-empty"><span class="vehicle-trips-empty-icon"><i data-lucide="truck"></i></span><strong>Nenhum veículo cadastrado</strong><p>Clique em “Cadastrar veículo” para incluir o primeiro veículo da frota.</p></div>'}</section>`;
        bindExpenseButtons();
        expensesPage.querySelector('[data-vehicle-action="new"]')?.addEventListener("click",()=>renderVehicleMaintenancePage(null,true));
        expensesPage.querySelector('[data-vehicle-action="cancel-new"]')?.addEventListener("click",()=>editingVehicle?renderVehicleMaintenancePage(editingVehicle.id):renderVehicleMaintenancePage());
        expensesPage.querySelectorAll("[data-vehicle-view]").forEach(button=>button.addEventListener("click",()=>renderVehicleMaintenancePage(button.dataset.vehicleView)));
        const form=$("#registeredVehicleForm",expensesPage), plateInput=form?.elements.plate;
        plateInput?.addEventListener("input",()=>{plateInput.value=plateInput.value.toUpperCase().replace(/[^A-Z0-9]/g,"").slice(0,7);});
        form?.addEventListener("submit",event=>{
            event.preventDefault();const fd=new FormData(form), plate=String(fd.get("plate")||"").trim().toUpperCase(), year=Number(fd.get("year")), currentKm=Number(fd.get("currentKm"));
            if(!plate||!year||!Number.isFinite(currentKm)||currentKm<0){showToast("Confira placa, ano e KM atual.");return;}
            if(getVehicleByPlate(plate)){showToast("Já existe um veículo cadastrado com esta placa.");return;}
            const item={id:`${Date.now()}-${Math.random().toString(36).slice(2,8)}`,plate,year,type:String(fd.get("type")||""),fuelType:String(fd.get("fuelType")||""),currentKm,costs:[],createdAt:new Date().toISOString()};
            registeredVehicles.push(item);if(!persistRegisteredVehicles()){registeredVehicles=registeredVehicles.filter(v=>v.id!==item.id);return;}
            showToast("Veículo cadastrado com sucesso.");renderVehicleMaintenancePage();
        });
        refreshIcons();
    }

    function renderVehicleExpenseCategory(title, description, icon) {
        if (!expensesPage) return;

        expensesPage.innerHTML = `
            <div class="expenses-page-header">
                <div class="eyebrow">GESTÃO FINANCEIRA / VEÍCULOS</div>
                <h1>${title}<span class="blue-period">.</span></h1>
                <p>${description}</p>

                <button type="button" class="button-secondary"
                    data-expense-action="back-vehicles" style="margin-top:16px">
                    <i data-lucide="arrow-left"></i> Voltar para Veículos
                </button>
            </div>

            <div class="expenses-options">
                <div class="expenses-option" role="status" style="cursor:default">
                    <span class="expenses-option-icon"><i data-lucide="${icon}"></i></span>
                    <span class="expenses-option-copy">
                        <strong>Módulo em preparação</strong>
                        <span>A área de manutenção será desenvolvida em uma próxima etapa.</span>
                    </span>
                </div>
            </div>
        `;

        bindExpenseButtons();
        refreshIcons();
    }


    // LEITURA E INTERPRETAÇÃO DE MANIFESTOS
    function loadExternalScript(src, globalName) {
        if (window[globalName]) return Promise.resolve(window[globalName]);
        return new Promise((resolve, reject) => {
            const existing = document.querySelector('script[data-prime-library="' + globalName + '"]');
            if (existing) {
                existing.addEventListener("load", () => resolve(window[globalName]), { once: true });
                existing.addEventListener("error", () => reject(new Error("Não foi possível carregar a biblioteca de leitura.")), { once: true });
                return;
            }
            const script = document.createElement("script");
            script.src = src;
            script.async = true;
            script.dataset.primeLibrary = globalName;
            script.onload = () => window[globalName] ? resolve(window[globalName]) : reject(new Error("A biblioteca de leitura não foi inicializada."));
            script.onerror = () => reject(new Error("Falha ao carregar a biblioteca. Verifique sua conexão com a internet."));
            document.head.appendChild(script);
        });
    }
    async function readManifestFile(file) {
        const extension = (file.name.split(".").pop() || "").toLowerCase();
        if (extension === "pdf") {
            const pdfjs = await loadExternalScript("https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js", "pdfjsLib");
            pdfjs.GlobalWorkerOptions.workerSrc = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js";
            const pdf = await pdfjs.getDocument({ data: await file.arrayBuffer() }).promise;
            const pages = [];
            for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
                const page = await pdf.getPage(pageNumber);
                const textContent = await page.getTextContent();
                pages.push(textContent.items.map((item) => item.str || "").join(" "));
            }
            const text = pages.join("\n");
            if (!text.replace(/\s/g, "")) throw new Error("Este PDF não contém texto selecionável. Envie um PDF pesquisável ou uma imagem.");
            return text;
        }
        if (extension === "xlsx" || extension === "xls") {
            const XLSX = await loadExternalScript("https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js", "XLSX");
            const workbook = XLSX.read(await file.arrayBuffer(), { type: "array" });
            return workbook.SheetNames.map((name) => XLSX.utils.sheet_to_csv(workbook.Sheets[name], { FS: " " })).join("\n");
        }
        if (extension === "csv" || extension === "xml" || extension === "txt") return await file.text();
        if (["jpg", "jpeg", "png"].includes(extension)) {
            const Tesseract = await loadExternalScript("https://cdn.jsdelivr.net/npm/tesseract.js@5/dist/tesseract.min.js", "Tesseract");
            const result = await Tesseract.recognize(file, "por");
            return result.data.text || "";
        }
        throw new Error("Formato não suportado. Importe PDF, Excel, CSV, XML ou imagem JPG/PNG.");
    }
    function parseBrazilianNumber(value) {
        if (value === null || value === undefined || value === "") return null;
        const number = Number(String(value).replace(/\./g, "").replace(",", ".").replace(/[^\d.-]/g, ""));
        return Number.isFinite(number) ? number : null;
    }
    function formatManifestNumber(value, decimals = 2) {
        if (value === null || value === undefined || !Number.isFinite(Number(value))) return "—";
        return new Intl.NumberFormat("pt-BR", { minimumFractionDigits: decimals, maximumFractionDigits: decimals }).format(Number(value));
    }
    function parseManifestData(sourceText) {
        const flatText = String(sourceText || "").replace(/\u00a0/g, " ").replace(/\s+/g, " ").trim();
        const cteCodes = [...flatText.matchAll(/\bCWB\d{6,}-\d\b/gi)].map((match) => match[0].toUpperCase());
        const uniqueCteCodes = [...new Set(cteCodes)];
        let totalCtes = uniqueCteCodes.length, totalWeight = null, totalVolumes = null, totalFreight = null;
        const totalsPattern = /T\s*O\s*T\s*A\s*I\s*S\s*D\s*O\s*M\s*D\s*F\s*E/ig;
        let totalsMatch, lastTotalsMatch = null;
        while ((totalsMatch = totalsPattern.exec(flatText)) !== null) lastTotalsMatch = totalsMatch;
        if (lastTotalsMatch) {
            const totalsText = flatText.slice(lastTotalsMatch.index + lastTotalsMatch[0].length);
            const numbers = totalsText.match(/\d[\d.]*,\d+|\d+/g) || [];
            if (numbers.length >= 6) {
                totalCtes = parseBrazilianNumber(numbers[0]) ?? totalCtes;
                totalWeight = parseBrazilianNumber(numbers[1]);
                totalVolumes = parseBrazilianNumber(numbers[3]);
                totalFreight = parseBrazilianNumber(numbers[5]);
            }
        }
        const cteRows = [];
        const starts = [...flatText.matchAll(/\b(CWB\d{6,}-\d)\b/gi)];
        starts.forEach((start, index) => {
            const segmentStart = start.index + start[0].length;
            const segmentEnd = index + 1 < starts.length ? starts[index + 1].index : flatText.length;
            const segment = flatText.slice(segmentStart, segmentEnd);
            const rowMatch = /\b([A-Z]{2})\s+([A-ZÀ-Ü][A-ZÀ-Ü ]*?)\s+([\d.]+,\d+|\d+)\s+([\d.]+,\d+|\d+)\s+(\d+)\s+([\d.]+,\d+|\d+)\s+([\d.]+,\d+|\d+)\s+([\d.]+,\d+|\d+)\s+[CFT]\s+\d{3}\b/i.exec(segment);
            if (!rowMatch) return;
            cteRows.push({ cte: start[1].toUpperCase(), uf: rowMatch[1].toUpperCase(), city: rowMatch[2].trim().replace(/\s+/g, " "),
                weightKg: parseBrazilianNumber(rowMatch[3]), calculatedWeightKg: parseBrazilianNumber(rowMatch[4]),
                volumes: parseBrazilianNumber(rowMatch[5]), goodsValue: parseBrazilianNumber(rowMatch[6]),
                freightValue: parseBrazilianNumber(rowMatch[7]), icmsValue: parseBrazilianNumber(rowMatch[8]) });
        });
        const cities = [...new Set(cteRows.map((row) => row.city).filter(Boolean))];
        const operationalMatch = flatText.match(/MANIFESTO\s+OPERACIONAL[\s\S]{0,260}?\b([A-Z]{3}\d{6}-\d)\b/i);
        const plateMatch = flatText.match(/\b([A-Z]{3}\d[A-Z0-9]\d{2})\b/i);
        const driverMatch = flatText.match(/\b\d{3}\.\d{3}\.\d{3}-\d{2}\s+([A-ZÀ-Ü]+(?:\s+[A-ZÀ-Ü]+){1,4})\b/i);
        return { totalCtes: totalCtes || cteRows.length || null, totalWeight, cities, totalVolumes, totalFreight,
            operationalManifest: operationalMatch ? operationalMatch[1].toUpperCase() : "",
            plate: plateMatch ? plateMatch[1].toUpperCase() : "", driver: driverMatch ? driverMatch[1].trim() : "",
            cteRows, parsedAt: new Date().toISOString() };
    }
    function generateVehicleTripReport(trip) {
        const data = trip.manifestData || {};
        const costs = Array.isArray(trip.extraCosts) ? trip.extraCosts : [];
        const vehiclePay = Number(trip.vehiclePay) || 0;
        const extras = costs.reduce((sum, item) => sum + (Number(item.amount) || 0), 0);
        const totalCost = vehiclePay + extras;
        const revenue = Number(data.totalFreight) || 0;
        const distance = Number(trip.returnKm) > 0 && Number(trip.startKm) >= 0 ? Number(trip.returnKm) - Number(trip.startKm) : 0;
        const result = revenue - totalCost;
        const perKm = (value) => distance > 0 ? money(value / distance) : "—";
        const costRows = costs.map((item) => '<tr><td>' + escapeHTML(item.date ? dateLabel(item.date) : "—") + '</td><td>' + escapeHTML(item.category || "Outro") + '</td><td>' + escapeHTML([item.location, item.description, item.fuelType, item.liters ? item.liters + " L" : ""].filter(Boolean).join(" • ") || "—") + '</td><td>' + money(Number(item.amount) || 0) + '</td></tr>').join("");
        const ctes = (data.cteRows || []).map((item) => '<tr><td>' + escapeHTML(item.cte || "—") + '</td><td>' + escapeHTML((item.city || "—") + (item.uf ? "/" + item.uf : "")) + '</td><td>' + (item.weightKg == null ? "—" : formatManifestNumber(item.weightKg, 1)) + '</td><td>' + (item.volumes == null ? "—" : formatManifestNumber(item.volumes, 0)) + '</td><td>' + money(Number(item.freightValue) || 0) + '</td></tr>').join("");
        const win = window.open("", "_blank");
        if (!win) { showToast("Permita pop-ups para gerar o relatório PDF."); return; }
        win.document.write('<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><title>Relatório de viagem PRIME</title><style>body{font:13px Arial;color:#172033;margin:30px}h1{color:#12345a}h2{font-size:16px;border-bottom:1px solid #cbd5e1;padding-bottom:7px;margin-top:24px}.muted{color:#64748b}.grid{display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin:20px 0}.metric{border:1px solid #cbd5e1;border-radius:7px;padding:12px}.metric span{display:block;color:#64748b;font-size:10px;margin-bottom:7px}.metric strong{font-size:15px}table{width:100%;border-collapse:collapse}td,th{text-align:left;padding:8px;border-bottom:1px solid #e2e8f0}th{background:#f1f5f9}@media print{body{margin:12mm}.no-print{display:none}}@media(max-width:650px){.grid{grid-template-columns:repeat(2,1fr)}}</style></head><body><div class="muted">PRIME • RELATÓRIO OPERACIONAL E FINANCEIRO</div><h1>Relatório completo da viagem</h1><p class="muted">Gerado em ' + escapeHTML(dateLabel(localISO())) + '</p><h2>Identificação</h2><p><b>Motorista:</b> ' + escapeHTML(trip.driver || "—") + ' &nbsp; <b>Placa:</b> ' + escapeHTML(trip.plate || "—") + '</p><p><b>Data:</b> ' + escapeHTML(dateLabel(trip.tripDate)) + ' &nbsp; <b>Status:</b> ' + (trip.finalizedAt ? "Finalizada" : "Em andamento") + '</p><p><b>Manifesto:</b> ' + escapeHTML(trip.manifestName || "—") + ' &nbsp; <b>Manifesto operacional:</b> ' + escapeHTML(data.operationalManifest || "—") + '</p><div class="grid"><div class="metric"><span>Receita de frete</span><strong>' + money(revenue) + '</strong></div><div class="metric"><span>Custo total</span><strong>' + money(totalCost) + '</strong></div><div class="metric"><span>Resultado estimado</span><strong>' + money(result) + '</strong></div><div class="metric"><span>KM rodados</span><strong>' + (distance > 0 ? distance.toLocaleString("pt-BR") + " km" : "—") + '</strong></div><div class="metric"><span>Pagamento do veículo</span><strong>' + money(vehiclePay) + '</strong></div><div class="metric"><span>Custos extras</span><strong>' + money(extras) + '</strong></div><div class="metric"><span>Custo por KM</span><strong>' + perKm(totalCost) + '</strong></div><div class="metric"><span>Receita por KM</span><strong>' + perKm(revenue) + '</strong></div></div><h2>Manifesto</h2><p><b>CT-es:</b> ' + escapeHTML(data.totalCtes ?? "—") + ' &nbsp; <b>Peso:</b> ' + (data.totalWeight == null ? "—" : formatManifestNumber(data.totalWeight, 1) + " kg") + ' &nbsp; <b>Volumes:</b> ' + (data.totalVolumes == null ? "—" : formatManifestNumber(data.totalVolumes, 0)) + '</p><p><b>Cidades:</b> ' + escapeHTML((data.cities || []).join(", ") || "—") + '</p><h2>Custos detalhados</h2><table><thead><tr><th>Data</th><th>Categoria</th><th>Descrição</th><th>Valor</th></tr></thead><tbody><tr><td>' + escapeHTML(dateLabel(trip.tripDate)) + '</td><td>Pagamento do veículo</td><td>Pagamento principal</td><td>' + money(vehiclePay) + '</td></tr>' + (costRows || '<tr><td colspan="4">Nenhum custo extra cadastrado.</td></tr>') + '<tr><th colspan="3">TOTAL</th><th>' + money(totalCost) + '</th></tr></tbody></table><h2>CT-es identificados</h2>' + (ctes ? '<table><thead><tr><th>CT-e</th><th>Cidade</th><th>Peso kg</th><th>Volumes</th><th>Frete</th></tr></thead><tbody>' + ctes + '</tbody></table>' : '<p>Não há dados individuais de CT-es disponíveis.</p>') + '<p class="muted">Relatório gerado pelo PRIME com base nos dados cadastrados.</p><div class="no-print"><button onclick="window.print()">Imprimir / Salvar como PDF</button></div><script>window.onload=()=>setTimeout(()=>window.print(),300);<\/script></body></html>');
        win.document.close();
    }

    function renderVehicleTripDetailsMarkup(trip) {
        const data = trip.manifestData || {};
        const dash = (value) => value === null || value === undefined || value === "" ? "—" : escapeHTML(String(value));
        const cteRows = Array.isArray(data.cteRows) ? data.cteRows : [];
        const cities = Array.isArray(data.cities) ? data.cities : [];
        const costs = Array.isArray(trip.extraCosts) ? trip.extraCosts : [];
        const isFinalized = Boolean(trip.finalizedAt);
        const totalExtras = costs.reduce((sum, cost) => sum + (Number(cost.amount) || 0), 0);
        const vehiclePay = Number(trip.vehiclePay) || 0;
        const tripKm = Number(trip.returnKm) > 0 && Number(trip.startKm) >= 0 ? Number(trip.returnKm) - Number(trip.startKm) : 0;
        const totalCost = vehiclePay + totalExtras;
        const revenue = Number(data.totalFreight) || 0;
        const result = revenue - totalCost;
        const metrics = [["QTDE CTe", dash(data.totalCtes)], ["PESO TOTAL (KG)", data.totalWeight == null ? "—" : formatManifestNumber(data.totalWeight, 1) + " kg"], ["QVOL", data.totalVolumes == null ? "—" : formatManifestNumber(data.totalVolumes, 0)], ["VAL FRETE", data.totalFreight == null ? "—" : "R$ " + formatManifestNumber(data.totalFreight, 2)]];
        const metricHtml = metrics.map((item) => '<article class="vehicle-trip-metric"><span>' + item[0] + '</span><strong>' + item[1] + '</strong></article>').join("");
        const cityHtml = cities.length ? '<div class="vehicle-trip-city-list">' + cities.map((city) => '<span>' + escapeHTML(city) + '</span>').join("") + '</div>' : '<p class="vehicle-trip-no-data">Nenhuma cidade foi identificada no manifesto.</p>';
        const rowHtml = cteRows.map((row) => '<tr><td>' + escapeHTML(row.cte) + '</td><td>' + escapeHTML(row.city + (row.uf ? "/" + row.uf : "")) + '</td><td>' + (row.weightKg == null ? "—" : formatManifestNumber(row.weightKg, 1)) + '</td><td>' + (row.volumes == null ? "—" : formatManifestNumber(row.volumes, 0)) + '</td><td>' + (row.freightValue == null ? "—" : "R$ " + formatManifestNumber(row.freightValue, 2)) + '</td></tr>').join("");
        const costRows = costs.length ? costs.map((cost) => '<div class="vehicle-trip-cost-row"><div><strong>' + escapeHTML(cost.category || "Outro custo") + '</strong><span>' + escapeHTML([cost.location, cost.fuelType, cost.liters ? cost.liters + " L" : "", cost.km ? "KM " + cost.km : "", cost.description].filter(Boolean).join(" • ")) + '</span></div><strong>' + money(Number(cost.amount) || 0) + '</strong>' + (isFinalized ? '' : '<button type="button" class="button-secondary" data-cost-delete="' + escapeHTML(cost.id) + '" aria-label="Excluir custo extra"><i data-lucide="trash-2"></i></button>') + '</div>').join("") : '<p class="vehicle-trip-no-data">Nenhum custo extra cadastrado nesta viagem.</p>';
        return '<div class="expenses-page-header"><div class="eyebrow">GESTÃO FINANCEIRA / VEÍCULOS / VIAGENS</div><h1>Detalhes da viagem<span class="blue-period">.</span></h1><p>Dados cadastrais, custos e informações extraídas do manifesto.</p><div class="vehicle-trips-toolbar"><button type="button" class="button-secondary" data-trip-action="back-list"><i data-lucide="arrow-left"></i> Voltar para viagens</button>' + (isFinalized ? '<span class="vehicle-trip-status-finalized">Viagem finalizada</span><button type="button" class="button-primary" data-trip-action="reopen-trip"><i data-lucide="rotate-ccw"></i> Reabrir viagem</button>' : '<button type="button" class="button-primary" data-trip-action="finalize-trip"><i data-lucide="check-circle"></i> Finalizar viagem</button>') + '<button type="button" class="button-secondary" data-trip-action="trip-report"><i data-lucide="file-down"></i> Relatório PDF</button>' + ((!trip.manifestName || !trip.manifestData) ? '<button type="button" class="button-primary" data-trip-action="add-manifest"><i data-lucide="file-plus-2"></i> ' + (trip.manifestName ? 'Atualizar manifesto' : 'Adicionar manifesto') + '</button><input type="file" data-trip-manifest-later accept=".pdf,.xlsx,.xls,.csv,.xml,.jpg,.jpeg,.png" hidden>' : '') + '<button type="button" class="button-danger" data-trip-action="delete-trip"><i data-lucide="trash-2"></i> Excluir viagem</button></div></div>' +
        '<section class="vehicle-trip-details-panel"><div class="vehicle-trip-details-heading"><div><span class="vehicle-trip-detail-kicker">DADOS DA VIAGEM</span><h2>' + escapeHTML(trip.driver || "Motorista não informado") + '</h2><p>Placa: ' + escapeHTML(trip.plate || "—") + ' <span>•</span> Data: ' + escapeHTML(dateLabel(trip.tripDate)) + '</p></div><span class="vehicle-trip-details-file"><i data-lucide="file-check-2"></i> ' + escapeHTML(trip.manifestName || "Manifesto não anexado") + '</span></div><div class="vehicle-trip-metrics">' + metricHtml + '</div><div class="vehicle-trip-detail-section"><h3><i data-lucide="map-pin"></i> Cidades destinatárias</h3>' + cityHtml + '</div><div class="vehicle-trip-detail-section vehicle-trip-operational-code"><h3><i data-lucide="file-text"></i> Manifesto operacional</h3><strong>' + dash(data.operationalManifest) + '</strong></div>' +
        '<section class="vehicle-trip-detail-section"><div class="vehicle-trip-table-heading"><div><h3><i data-lucide="files"></i> CT-es identificados</h3><p>Expanda somente quando precisar conferir os documentos.</p></div><span>' + cteRows.length + ' CT-e(s)</span></div><details class="vehicle-trip-cte-disclosure"><summary>Ver CT-es identificados</summary>' + (cteRows.length ? '<div class="vehicle-trip-table-wrap"><table class="vehicle-trip-cte-table"><thead><tr><th>CT-e</th><th>Cidade</th><th>Peso (kg)</th><th>QVOL</th><th>Val. frete</th></tr></thead><tbody>' + rowHtml + '</tbody></table></div>' : '<p class="vehicle-trip-no-data">Não foi possível separar os CT-es individuais deste arquivo. Os dados gerais identificados continuam disponíveis acima.</p>') + '</details></section>' +
        '<section class="vehicle-trip-detail-section"><h3><i data-lucide="gauge"></i> Quilometragem e pagamento do veículo</h3>' + (isFinalized ? '<p class="vehicle-trip-locked-note">Esta viagem foi finalizada. Os dados estão bloqueados para edição.</p>' : '') + '<form id="tripCostsForm" class="vehicle-trip-cost-form"' + (isFinalized ? ' hidden' : '') + '><label class="form-field">Valor pago ao veículo (R$)<input type="number" name="vehiclePay" min="0" step="0.01" value="' + (trip.vehiclePay ?? "") + '" placeholder="0,00"></label><label class="form-field">KM de saída<input type="number" name="startKm" min="0" step="1" value="' + (trip.startKm ?? "") + '" placeholder="Ex.: 125000"></label><label class="form-field">KM de retorno<input type="number" name="returnKm" min="0" step="1" value="' + (trip.returnKm ?? "") + '" placeholder="Ex.: 125650"></label><div class="vehicle-trip-cost-form-actions"><button class="button-primary" type="submit"><i data-lucide="save"></i> Salvar dados</button></div></form><div class="vehicle-trip-cost-summary"><div><span>Distância percorrida</span><strong>' + (tripKm > 0 ? formatManifestNumber(tripKm, 0) + ' km' : '—') + '</strong></div><div><span>Custos extras</span><strong>' + money(totalExtras) + '</strong></div><div><span>Custo total registrado</span><strong>' + money(totalCost) + '</strong></div><div><span>Resultado estimado do frete</span><strong>' + money(result) + '</strong></div></div></section>' +
        '<section class="vehicle-trip-detail-section"><div class="vehicle-trip-table-heading"><div><h3><i data-lucide="receipt-text"></i> Custos extras da viagem</h3><p>Abastecimentos, diárias, manutenção e outros custos.</p></div>' + (isFinalized ? '' : '<button type="button" class="button-primary" data-trip-action="add-cost"><i data-lucide="plus"></i> Add custo extra</button>') + '</div><div class="vehicle-trip-cost-list">' + costRows + '</div><form id="extraCostForm" class="vehicle-trip-extra-form" hidden><h3>Novo custo extra</h3><label class="form-field">Tipo de custo<select name="category" required><option value="Combustível">Combustível</option><option value="Diária">Diária</option><option value="Manutenção">Manutenção</option><option value="Pedágio">Pedágio</option><option value="Estacionamento">Estacionamento</option><option value="Alimentação">Alimentação</option><option value="Hospedagem">Hospedagem</option><option value="Outro">Outro</option><option value="__custom__">+ Cadastrar novo tipo de custo</option></select></label><div class="extra-cost-fields" data-extra-fields></div><div class="vehicle-trip-form-actions"><button type="button" class="button-secondary" data-trip-action="cancel-cost">Cancelar</button><button type="submit" class="button-primary"><i data-lucide="save"></i> Salvar custo</button></div></form></section></section>';
    }


    function renderVehicleTripsPage(showForm = false, viewTripId = null) {
        if (!expensesPage) return;

        if (viewTripId) {
            const selectedTrip = vehicleTrips.find((trip) => String(trip.id) === String(viewTripId));
            if (selectedTrip) {
                expensesPage.innerHTML = renderVehicleTripDetailsMarkup(selectedTrip);
                bindExpenseButtons();
                $("[data-trip-action='back-list']", expensesPage)?.addEventListener("click", () => renderVehicleTripsPage(false));
                $("[data-trip-action='delete-trip']", expensesPage)?.addEventListener("click", () => {
                    if (!window.confirm("Tem certeza que deseja excluir esta viagem e todos os custos extras vinculados? Esta ação não poderá ser desfeita.")) return;
                    const previous = vehicleTrips;
                    vehicleTrips = vehicleTrips.filter((item) => String(item.id) !== String(selectedTrip.id));
                    if (!persistVehicleTrips()) { vehicleTrips = previous; return; }
                    showToast("Viagem excluída com sucesso.");
                    renderVehicleTripsPage(false);
                });
                $("[data-trip-action='reopen-trip']", expensesPage)?.addEventListener("click", () => {
                    if (!selectedTrip.finalizedAt) return;
                    if (!window.confirm("Reabrir esta viagem? Ela deixará de ser contabilizada no dashboard até ser finalizada novamente, e os valores poderão voltar a ser alterados.")) return;
                    const previousFinalizedAt = selectedTrip.finalizedAt;
                    delete selectedTrip.finalizedAt;
                    if (!persistVehicleTrips()) { selectedTrip.finalizedAt = previousFinalizedAt; return; }
                    updateDashboard();
                    showToast("Viagem reaberta. Você já pode editar os valores.");
                    renderVehicleTripsPage(false, selectedTrip.id);
                });
                $("[data-trip-action='finalize-trip']", expensesPage)?.addEventListener("click", () => {
                    if (!(Number(selectedTrip.manifestData?.totalFreight) > 0)) { showToast("Informe um valor de frete válido no manifesto antes de finalizar."); return; }
                    if (!window.confirm("Finalizar esta viagem? Os valores serão contabilizados no dashboard e não poderão mais ser alterados.")) return;
                    const oldValue = selectedTrip.finalizedAt;
                    const matchingVehicle = getVehicleByPlate(selectedTrip.plate);
                    const previousKm = matchingVehicle ? matchingVehicle.currentKm : null;
                    selectedTrip.finalizedAt = new Date().toISOString();
                    if (matchingVehicle && selectedTrip.returnKm !== null && selectedTrip.returnKm !== undefined && selectedTrip.returnKm !== "" && Number.isFinite(Number(selectedTrip.returnKm)) && Number(selectedTrip.returnKm) >= 0) matchingVehicle.currentKm = Number(selectedTrip.returnKm);
                    if (!persistVehicleTrips()) {
                        selectedTrip.finalizedAt = oldValue;
                        if (matchingVehicle && previousKm !== null) matchingVehicle.currentKm = previousKm;
                        return;
                    }
                    if (matchingVehicle && !persistRegisteredVehicles()) {
                        selectedTrip.finalizedAt = oldValue;
                        if (previousKm !== null) matchingVehicle.currentKm = previousKm;
                        persistVehicleTrips();
                        return;
                    }
                    updateDashboard();
                    showToast(matchingVehicle && selectedTrip.returnKm !== null && selectedTrip.returnKm !== undefined && selectedTrip.returnKm !== ""
                        ? "Viagem finalizada. KM do veículo atualizado para " + Number(selectedTrip.returnKm).toLocaleString("pt-BR") + "."
                        : "Viagem finalizada e contabilizada no dashboard.");
                    renderVehicleTripsPage(false, selectedTrip.id);
                });
                $("[data-trip-action='trip-report']", expensesPage)?.addEventListener("click", () => generateVehicleTripReport(selectedTrip));
                const addManifestButton = $("[data-trip-action='add-manifest']", expensesPage);
                const laterManifestInput = $("[data-trip-manifest-later]", expensesPage);
                addManifestButton?.addEventListener("click", () => laterManifestInput?.click());
                laterManifestInput?.addEventListener("change", async () => {
                    const file = laterManifestInput.files?.[0];
                    if (!file) return;
                    addManifestButton.disabled = true;
                    addManifestButton.innerHTML = '<i data-lucide="loader-circle"></i> Lendo manifesto...';
                    refreshIcons();
                    try {
                        const extractedText = await readManifestFile(file);
                        const parsedData = parseManifestData(extractedText);
                        const foundAnyData = parsedData.totalCtes || parsedData.totalWeight !== null || parsedData.totalVolumes !== null || parsedData.totalFreight !== null || parsedData.operationalManifest || parsedData.cteRows.length;
                        if (!foundAnyData) throw new Error("Não encontrei os campos esperados neste manifesto. Confira se o arquivo contém os dados operacionais no padrão esperado.");
                        const previousName = selectedTrip.manifestName;
                        const previousData = selectedTrip.manifestData;
                        selectedTrip.manifestName = file.name;
                        selectedTrip.manifestData = parsedData;
                        if (!persistVehicleTrips()) {
                            selectedTrip.manifestName = previousName;
                            selectedTrip.manifestData = previousData;
                            return;
                        }
                        if (selectedTrip.finalizedAt) updateDashboard();
                        showToast("Manifesto adicionado à viagem com sucesso.");
                        renderVehicleTripsPage(false, selectedTrip.id);
                    } catch (error) {
                        console.error("Erro ao adicionar manifesto à viagem:", error);
                        showToast(error.message || "Não foi possível ler o manifesto selecionado.");
                    } finally {
                        if (addManifestButton.isConnected) {
                            addManifestButton.disabled = false;
                            addManifestButton.innerHTML = '<i data-lucide="file-plus-2"></i> Adicionar manifesto';
                            refreshIcons();
                        }
                    }
                });
                const tripCostsForm = $("#tripCostsForm", expensesPage);
                tripCostsForm?.addEventListener("submit", (event) => {
                    event.preventDefault();
                    if (selectedTrip.finalizedAt) { showToast("Esta viagem está finalizada e bloqueada."); return; }
                    const fd = new FormData(tripCostsForm);
                    const startKm = fd.get("startKm") === "" ? null : Number(fd.get("startKm"));
                    const returnKm = fd.get("returnKm") === "" ? null : Number(fd.get("returnKm"));
                    if (startKm !== null && returnKm !== null && returnKm < startKm) { showToast("O KM de retorno não pode ser menor que o KM de saída."); return; }
                    selectedTrip.vehiclePay = Number(fd.get("vehiclePay")) || 0;
                    selectedTrip.startKm = startKm;
                    selectedTrip.returnKm = returnKm;
                    if (!persistVehicleTrips()) return;
                    showToast("Dados financeiros da viagem salvos.");
                    renderVehicleTripsPage(false, selectedTrip.id);
                });
                const extraCostForm = $("#extraCostForm", expensesPage);
                const extraFields = $("[data-extra-fields]", expensesPage);
                const categorySelect = extraCostForm?.elements.category;
                const renderExtraFields = () => {
                    if (!extraFields || !categorySelect) return;
                    const category = categorySelect.value;
                    const field = (label, name, type = "text", placeholder = "", required = false, options = "") => {
                        const requiredAttribute = required ? " required" : "";
                        const numberAttributes = type === "number" ? ' min="0" step="0.01"' : "";
                        let control = "";

                        if (type === "select") {
                            control = '<select name="' + name + '"' + requiredAttribute + '>' + options + '</select>';
                        } else {
                            control = '<input name="' + name + '" type="' + type + '"' + numberAttributes + ' placeholder="' + placeholder + '"' + requiredAttribute + '>';
                        }

                        return '<label class="form-field">' + label + control + '</label>';
                    };
                    let html = "";
                    if (category === "__custom__") {
                        html += field("Nome do novo tipo de custo", "customCategory", "text", "Ex.: lavagem", true);
                        html += field("Descrição", "description", "text", "Detalhes do custo");
                        html += field("Local", "location", "text", "Opcional");
                        html += field("Valor pago (R$)", "amount", "number", "0,00", true);
                        html += field("Data", "date", "date");
                    } else if (category === "Combustível") {
                        html += field("Local do abastecimento", "location", "text", "Nome do posto", true);
                        html += field("Combustível", "fuelType", "select", "", true, '<option>Gasolina</option><option>Gasolina aditivada</option><option>Etanol</option><option>Arla</option><option>Diesel</option>');
                        html += field("Quantidade (litros)", "liters", "number", "0,00", true);
                        html += field("Valor por litro (R$)", "unitPrice", "number", "0,00");
                        html += field("Valor total pago (R$)", "amount", "number", "0,00", true);
                        html += field("KM do abastecimento", "km", "number", "Ex.: 125400", true);
                    } else if (category === "Diária") {
                        html += field("Valor pago (R$)", "amount", "number", "0,00", true);
                        html += field("Data", "date", "date");
                        html += field("Descrição", "description", "text", "Ex.: diária do motorista");
                    } else if (category === "Manutenção") {
                        html += field("Local da manutenção", "location", "text", "Oficina ou cidade", true);
                        html += field("Descrição do serviço", "description", "text", "Ex.: troca de óleo", true);
                        html += field("Valor pago (R$)", "amount", "number", "0,00", true);
                        html += field("Data", "date", "date");
                    } else {
                        html += field("Descrição", "description", "text", "Descreva o custo", true);
                        html += field("Local", "location", "text", "Opcional");
                        html += field("Valor pago (R$)", "amount", "number", "0,00", true);
                        html += field("Data", "date", "date");
                    }
                    extraFields.innerHTML = html;
                };
                $("[data-trip-action='add-cost']", expensesPage)?.addEventListener("click", () => {
                    if (!extraCostForm) return;
                    extraCostForm.hidden = false; renderExtraFields();
                    extraCostForm.scrollIntoView({ behavior: "smooth", block: "nearest" });
                });
                categorySelect?.addEventListener("change", renderExtraFields);
                $("[data-trip-action='cancel-cost']", expensesPage)?.addEventListener("click", () => { if (extraCostForm) { extraCostForm.reset(); extraCostForm.hidden = true; } });
                extraCostForm?.addEventListener("submit", (event) => {
                    event.preventDefault();
                    if (selectedTrip.finalizedAt) { showToast("Esta viagem está finalizada e bloqueada."); return; }
                    const fd = new FormData(extraCostForm);
                    const amount = Number(fd.get("amount")) || 0;
                    if (amount <= 0) { showToast("Informe um valor pago maior que zero."); return; }
                    const rawCategory = String(fd.get("category") || "Outro");
                    const cost = { id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`, category: String(rawCategory === "__custom__" ? fd.get("customCategory") : rawCategory || "Outro").trim(), amount, location: String(fd.get("location") || "").trim(), fuelType: String(fd.get("fuelType") || ""), liters: Number(fd.get("liters")) || null, unitPrice: Number(fd.get("unitPrice")) || null, km: Number(fd.get("km")) || null, description: String(fd.get("description") || "").trim(), date: String(fd.get("date") || "") };
                    if (!cost.category) { showToast("Informe o nome do novo tipo de custo."); return; }
                    if (!Array.isArray(selectedTrip.extraCosts)) selectedTrip.extraCosts = [];
                    selectedTrip.extraCosts.push(cost);
                    if (!persistVehicleTrips()) { selectedTrip.extraCosts.pop(); return; }
                    showToast("Custo extra cadastrado.");
                    renderVehicleTripsPage(false, selectedTrip.id);
                });
                expensesPage.querySelectorAll("[data-cost-delete]").forEach((button) => button.addEventListener("click", () => {
                    if (selectedTrip.finalizedAt) { showToast("Esta viagem está finalizada e bloqueada."); return; }
                    if (!window.confirm("Excluir este custo extra?")) return;
                    selectedTrip.extraCosts = (selectedTrip.extraCosts || []).filter((cost) => String(cost.id) !== String(button.dataset.costDelete));
                    if (!persistVehicleTrips()) return;
                    showToast("Custo extra excluído.");
                    renderVehicleTripsPage(false, selectedTrip.id);
                }));
                refreshIcons();
                return;
            }
        }

        const sortedTrips = [...vehicleTrips].sort((a, b) =>
            String(b.tripDate || "").localeCompare(String(a.tripDate || ""))
        );

        expensesPage.innerHTML = `
            <div class="expenses-page-header">
                <div class="eyebrow">GESTÃO FINANCEIRA / VEÍCULOS</div>
                <h1>Despesa de viagem<span class="blue-period">.</span></h1>
                <p>Cadastre viagens e mantenha os dados dos motoristas, veículos e manifestos organizados.</p>

                <div class="vehicle-trips-toolbar">
                    <button type="button" class="button-secondary"
                        data-expense-action="back-vehicles">
                        <i data-lucide="arrow-left"></i> Voltar para Veículos
                    </button>
                    ${showForm ? "" : `
                        <button type="button" class="button-primary" data-trip-action="new">
                            <i data-lucide="plus"></i> Cadastrar viagem
                        </button>
                    `}
                </div>
            </div>

            ${showForm ? `
                <section class="vehicle-trip-form-panel" aria-labelledby="vehicleTripFormTitle">
                    <div class="vehicle-trip-panel-heading">
                        <div>
                            <h2 id="vehicleTripFormTitle">Nova viagem</h2>
                            <p>Informe os dados básicos da viagem e selecione o manifesto, se já estiver disponível.</p>
                        </div>
                    </div>

                    <form id="vehicleTripForm" class="vehicle-trip-form">
                        <label class="form-field">
                            Motorista
                            <input type="text" name="driver" maxlength="120"
                                placeholder="Nome completo do motorista" required>
                        </label>

                        <label class="form-field">
                            Placa do veículo
                            <input type="text" name="plate" maxlength="8"
                                placeholder="ABC1D23" autocomplete="off" required>
                        </label>

                        <label class="form-field">
                            Data da viagem
                            <input type="date" name="tripDate" value="${todayISO}" required>
                        </label>

                        <div class="vehicle-trip-manifest-field">
                            <span class="form-field-label">Manifesto da viagem</span>
                            <input type="file" data-trip-manifest
                                accept=".pdf,.xlsx,.xls,.csv,.xml,.jpg,.jpeg,.png"
                                hidden>
                            <button type="button" class="button-secondary vehicle-trip-import-button"
                                data-trip-action="import-manifest">
                                <i data-lucide="file-up"></i> Importar manifesto
                            </button>
                            <p class="vehicle-trip-file-name" data-trip-file-name>
                                Nenhum manifesto selecionado.
                            </p>
                            <p class="vehicle-trip-import-note" data-trip-import-status>
                                O PRIME vai identificar CT-es, peso, cidades destinatárias, volumes, valor do frete e manifesto operacional.
                            </p>
                        </div>

                        <div class="vehicle-trip-form-actions">
                            <button type="button" class="button-secondary" data-trip-action="cancel">
                                Cancelar
                            </button>
                            <button type="submit" class="button-primary">
                                <i data-lucide="save"></i> Salvar viagem
                            </button>
                        </div>
                    </form>
                </section>
            ` : ""}

            <section class="vehicle-trips-list-panel" aria-labelledby="vehicleTripsListTitle">
                <div class="vehicle-trip-panel-heading">
                    <div>
                        <h2 id="vehicleTripsListTitle">Viagens cadastradas</h2>
                        <p>Consulte os registros de viagens já adicionados ao PRIME.</p>
                    </div>
                    <span class="vehicle-trips-count">${sortedTrips.length} ${sortedTrips.length === 1 ? "viagem" : "viagens"}</span>
                </div>

                ${sortedTrips.length ? `
                    <div class="vehicle-trips-list">
                        ${sortedTrips.map((trip) => `
                            <article class="vehicle-trip-card">
                                <div class="vehicle-trip-card-icon">
                                    <i data-lucide="route"></i>
                                </div>
                                <div class="vehicle-trip-card-main">
                                    <strong>${escapeHTML(trip.driver)}</strong>
                                    <span>Placa: ${escapeHTML(trip.plate)}</span>
                                    <span>Data: ${dateLabel(trip.tripDate)}</span>
                                    ${trip.finalizedAt ? '<span class="vehicle-trip-status-finalized">Finalizada</span>' : '<span class="vehicle-trip-status-open">Em andamento</span>'}
                                    <span class="vehicle-trip-manifest-status">
                                        <i data-lucide="${trip.manifestName ? "file-check-2" : "file"}"></i>
                                        ${trip.manifestName ? "Manifesto: " + escapeHTML(trip.manifestName) : "Manifesto não anexado"}
                                    </span>
                                    ${trip.manifestData ? `<span class="vehicle-trip-card-summary">${trip.manifestData.totalCtes || "—"} CT-es • ${trip.manifestData.cities?.length || 0} cidades • ${trip.manifestData.operationalManifest || "Manifesto operacional não identificado"}</span>` : ""}
                                </div>
                                <button type="button" class="button-secondary vehicle-trip-view-button" data-trip-view="${escapeHTML(trip.id)}"><i data-lucide="eye"></i> VER</button>
                            </article>
                        `).join("")}
                    </div>
                ` : `
                    <div class="vehicle-trips-empty">
                        <span class="vehicle-trips-empty-icon"><i data-lucide="truck"></i></span>
                        <strong>Nenhuma viagem cadastrada</strong>
                        <p>Clique em “Cadastrar viagem” para registrar a primeira viagem.</p>
                    </div>
                `}
            </section>
        `;

        bindExpenseButtons();

        const form = $("#vehicleTripForm", expensesPage);
        const manifestInput = $("[data-trip-manifest]", expensesPage);
        const manifestName = $("[data-trip-file-name]", expensesPage);
        const importStatus = $("[data-trip-import-status]", expensesPage);
        let selectedManifestName = "";
        let selectedManifestData = null;

        $("[data-trip-action='new']", expensesPage)?.addEventListener("click", () => {
            renderVehicleTripsPage(true);
        });

        $("[data-trip-action='cancel']", expensesPage)?.addEventListener("click", () => {
            renderVehicleTripsPage(false);
        });

        $("[data-trip-action='import-manifest']", expensesPage)?.addEventListener("click", () => {
            manifestInput?.click();
        });

        manifestInput?.addEventListener("change", async () => {
            const file = manifestInput.files?.[0];
            selectedManifestName = file?.name || "";
            selectedManifestData = null;
            if (manifestName) manifestName.textContent = selectedManifestName || "Nenhum manifesto selecionado.";
            if (!file) return;
            if (importStatus) importStatus.textContent = "Lendo manifesto e identificando os dados...";
            const importButton = $("[data-trip-action='import-manifest']", expensesPage);
            if (importButton) { importButton.disabled = true; importButton.innerHTML = '<i data-lucide="loader-circle"></i> Lendo manifesto...'; }
            refreshIcons();
            try {
                const extractedText = await readManifestFile(file);
                const parsedData = parseManifestData(extractedText);
                const foundAnyData = parsedData.totalCtes || parsedData.totalWeight !== null || parsedData.totalVolumes !== null || parsedData.totalFreight !== null || parsedData.operationalManifest || parsedData.cteRows.length;
                if (!foundAnyData) throw new Error("Não encontrei os campos esperados. Confira se o arquivo contém o texto do manifesto no padrão da Maranata.");
                selectedManifestData = parsedData;
                if (importStatus) {
                    const missing = [];
                    if (!parsedData.totalCtes) missing.push("QTDE CTe");
                    if (parsedData.totalWeight === null) missing.push("peso total");
                    if (!parsedData.cities.length) missing.push("cidades");
                    if (parsedData.totalVolumes === null) missing.push("QVOL");
                    if (parsedData.totalFreight === null) missing.push("valor do frete");
                    if (!parsedData.operationalManifest) missing.push("manifesto operacional");
                    importStatus.textContent = missing.length ? "Leitura concluída, mas confira os campos não identificados: " + missing.join(", ") + "." : "Manifesto lido com sucesso: " + parsedData.totalCtes + " CT-es, " + parsedData.cities.length + " cidades e manifesto operacional " + parsedData.operationalManifest + ".";
                }
                if (parsedData.driver && !form?.elements.driver.value.trim()) form.elements.driver.value = parsedData.driver;
                if (parsedData.plate && !form?.elements.plate.value.trim()) form.elements.plate.value = parsedData.plate;
                showToast("Manifesto lido. Confira os dados e salve a viagem.");
            } catch (error) {
                console.error("Erro ao ler manifesto:", error);
                if (importStatus) importStatus.textContent = error.message || "Não foi possível ler este manifesto.";
                showToast(error.message || "Não foi possível ler o manifesto.");
            } finally {
                if (importButton) { importButton.disabled = false; importButton.innerHTML = '<i data-lucide="file-up"></i> Importar manifesto'; }
                refreshIcons();
            }
        });

        expensesPage.querySelectorAll("[data-trip-view]").forEach((button) => {
            button.addEventListener("click", () => renderVehicleTripsPage(false, button.dataset.tripView));
        });

        const plateInput = form?.elements.plate;
        plateInput?.addEventListener("input", () => {
            plateInput.value = plateInput.value.toUpperCase().replace(/[^A-Z0-9-]/g, "").slice(0, 8);
        });

        form?.addEventListener("submit", (event) => {
            event.preventDefault();

            const formData = new FormData(form);
            const driver = String(formData.get("driver") || "").trim();
            const plate = String(formData.get("plate") || "").trim().toUpperCase();
            const tripDate = String(formData.get("tripDate") || "");

            if (!driver || !plate || !tripDate) {
                showToast("Preencha motorista, placa e data da viagem.");
                return;
            }
            if (selectedManifestName && !selectedManifestData) {
                const continueWithoutData = window.confirm("O manifesto foi selecionado, mas não foi possível extrair os dados. Deseja salvar a viagem mesmo assim?");
                if (!continueWithoutData) return;
            }

            const trip = {
                id: `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
                driver,
                plate,
                tripDate,
                manifestName: selectedManifestName,
                manifestData: selectedManifestData,
                createdAt: new Date().toISOString()
            };

            vehicleTrips.push(trip);

            if (!persistVehicleTrips()) {
                vehicleTrips = vehicleTrips.filter((item) => item.id !== trip.id);
                return;
            }

            renderVehicleTripsPage(false);
            if ($("#currentPage")) {
                $("#currentPage").textContent = "Despesa de viagem";
            }
            showToast("Viagem cadastrada com sucesso.");
        });

        refreshIcons();
    }

    function bindExpenseButtons() {
        if (!expensesPage) return;

        expensesPage.querySelectorAll("[data-expense-section]").forEach((button) => {
            button.addEventListener("click", () => {
                openExpenseSection(button.dataset.expenseSection);
            });
        });

        expensesPage.querySelectorAll('[data-expense-action="back"]').forEach((button) => {
            button.addEventListener("click", () => {
                renderExpensesHome();

                if ($("#currentPage")) {
                    $("#currentPage").textContent = "Despesas";
                }

                window.scrollTo({ top: 0, behavior: "smooth" });
            });
        });

        expensesPage.querySelectorAll('[data-expense-action="back-vehicles"]').forEach((button) => {
            button.addEventListener("click", () => {
                renderVehicleOptions();

                if ($("#currentPage")) {
                    $("#currentPage").textContent = "Veículos";
                }

                window.scrollTo({ top: 0, behavior: "smooth" });
            });
        });
    }

    function openExpenseSection(section) {
        if (section === "matriz") {
            renderMatrixOptions();

            if ($("#currentPage")) {
                $("#currentPage").textContent = "Matriz";
            }

            window.scrollTo({ top: 0, behavior: "smooth" });
            return;
        }

        if (section === "variaveis") {
            renderVariableExpensesPage();

            if ($("#currentPage")) {
                $("#currentPage").textContent = "Despesas variáveis";
            }

            window.scrollTo({ top: 0, behavior: "smooth" });
            return;
        }

        if (section === "veiculos") {
            renderVehicleOptions();

            if ($("#currentPage")) {
                $("#currentPage").textContent = "Veículos";
            }

            window.scrollTo({ top: 0, behavior: "smooth" });
            return;
        }

        if (section === "despesa-viagem") {
            renderVehicleTripsPage(false);

            if ($("#currentPage")) {
                $("#currentPage").textContent = "Despesa de viagem";
            }

            window.scrollTo({ top: 0, behavior: "smooth" });
            return;
        }

        if (section === "despesa-manutencao") {
            renderVehicleMaintenancePage();
            if ($("#currentPage")) $("#currentPage").textContent = "FROTA";
            window.scrollTo({ top: 0, behavior: "smooth" });
            return;
        }

        if (section === "folha") {
            if (window.PRIMEPayroll) {
                window.PRIMEPayroll.onBack = () => { renderMatrixOptions(); if ($("#currentPage")) $("#currentPage").textContent = "Matriz"; window.scrollTo({ top: 0, behavior: "smooth" }); };
                window.PRIMEPayroll.render(expensesPage);
                if ($("#currentPage")) $("#currentPage").textContent = "Folha";
                window.scrollTo({ top: 0, behavior: "smooth" });
            } else { showToast("Não foi possível carregar o módulo Folha."); }
        }
    }

    function createExpensesPage() {
        if (expensesPage) return expensesPage;

        expensesPage = document.createElement("section");
        expensesPage.className = "expenses-page";
        expensesPage.setAttribute("aria-label", "Módulo de despesas");
        content.appendChild(expensesPage);

        renderExpensesHome();
        return expensesPage;
    }

    function showExpensesPage() {
        if (!content) return;

        originalContent.forEach((element) => {
            element.hidden = true;
        });

        const page = createExpensesPage();

        renderExpensesHome();

        // Garante que apenas uma tela de módulo fique visível por vez.
        // A tela Receitas é criada por um arquivo de navegação independente.
        Array.from(content.children).forEach((child) => {
            child.hidden = child !== page;
        });
        page.hidden = false;

        if ($("#currentPage")) {
            $("#currentPage").textContent = "Despesas";
        }

        window.scrollTo({ top: 0, behavior: "smooth" });
    }

    // --------------------------------------------------
    // DESPESAS VARIÁVEIS: LISTA E RESUMO
    // --------------------------------------------------

    function renderVariableExpensesPage() {
        if (!expensesPage) return;

        const installments = getInstallments();

        const totalMonth = installments
            .filter((item) => monthKey(item.date) === currentMonth())
            .reduce((sum, item) => sum + Number(item.amount || 0), 0);

        const pendingTotal = installments
            .filter((item) => !item.paid)
            .reduce((sum, item) => sum + Number(item.amount || 0), 0);

        const statusCounts = {
            all: variableExpenses.length,
            pending: variableExpenses.filter((expense) =>
                getExpenseStatus(expense.installments || []).key === "pending"
            ).length,
            paid: variableExpenses.filter((expense) =>
                getExpenseStatus(expense.installments || []).key === "paid"
            ).length,
            overdue: variableExpenses.filter((expense) =>
                getExpenseStatus(expense.installments || []).key === "overdue"
            ).length
        };

        const sortedExpenses = [...variableExpenses]
            .filter((expense) => {
                if (variableExpenseFilter === "all") return true;
                return getExpenseStatus(expense.installments || []).key === variableExpenseFilter;
            })
            .sort((a, b) =>
                (a.name || "").localeCompare(b.name || "", "pt-BR")
            );

        expensesPage.innerHTML = `
            <div class="expenses-page-header">
                <div class="eyebrow">GESTÃO FINANCEIRA / MATRIZ</div>
                <h1>Despesas variáveis<span class="blue-period">.</span></h1>
                <p>Cadastre despesas, acompanhe os vencimentos e organize os pagamentos da empresa.</p>

                <div class="variable-expenses-toolbar">
                    <button type="button" class="button-secondary" data-expense-action="matrix">
                        <i data-lucide="arrow-left"></i> Voltar para Matriz
                    </button>
                    <button type="button" class="button-primary" data-expense-action="new">
                        <i data-lucide="plus"></i> Cadastrar despesa
                    </button>
                </div>
            </div>

            <div class="variable-expenses-summary">
                <article class="variable-summary-card">
                    <span>Despesas com vencimento neste mês</span>
                    <strong>${money(totalMonth)}</strong>
                </article>

                <article class="variable-summary-card">
                    <span>Total pendente de pagamento</span>
                    <strong>${money(pendingTotal)}</strong>
                </article>

                <article class="variable-summary-card">
                    <span>Despesas cadastradas</span>
                    <strong>${variableExpenses.length}</strong>
                </article>
            </div>

            <section class="variable-expenses-panel">
                <div class="variable-expenses-panel-heading">
                    <div>
                        <h2>Despesas cadastradas</h2>
                        <p>Filtre por situação ou abra uma despesa para consultar as parcelas.</p>
                    </div>
                    <span class="variable-expenses-count">
                        ${sortedExpenses.length} de ${variableExpenses.length} registro(s)
                    </span>
                </div>

                <div class="expense-status-filters" role="group" aria-label="Filtrar despesas por status">
                    <button type="button" class="expense-filter-button ${variableExpenseFilter === "all" ? "active" : ""}"
                        data-expense-filter="all" aria-pressed="${variableExpenseFilter === "all"}">
                        Todas <span>${statusCounts.all}</span>
                    </button>
                    <button type="button" class="expense-filter-button ${variableExpenseFilter === "pending" ? "active" : ""}"
                        data-expense-filter="pending" aria-pressed="${variableExpenseFilter === "pending"}">
                        <i data-lucide="clock-3"></i> Pendentes <span>${statusCounts.pending}</span>
                    </button>
                    <button type="button" class="expense-filter-button ${variableExpenseFilter === "paid" ? "active" : ""}"
                        data-expense-filter="paid" aria-pressed="${variableExpenseFilter === "paid"}">
                        <i data-lucide="check-circle-2"></i> Pagas <span>${statusCounts.paid}</span>
                    </button>
                    <button type="button" class="expense-filter-button ${variableExpenseFilter === "overdue" ? "active" : ""}"
                        data-expense-filter="overdue" aria-pressed="${variableExpenseFilter === "overdue"}">
                        <i data-lucide="alert-circle"></i> Vencidas <span>${statusCounts.overdue}</span>
                    </button>
                </div>

                ${sortedExpenses.length ? `
                    <div class="variable-expense-list">
                        ${sortedExpenses.map((expense) => renderExpenseCard(expense)).join("")}
                    </div>
                ` : variableExpenses.length ? `
                    <div class="variable-expenses-empty variable-expenses-filter-empty">
                        <span class="variable-empty-icon">
                            <i data-lucide="filter-x"></i>
                        </span>
                        <h3>Nenhuma despesa nesta situação</h3>
                        <p>Não há despesas que correspondam ao filtro selecionado.</p>
                        <button type="button" class="button-secondary" data-expense-filter="all">
                            Mostrar todas as despesas
                        </button>
                    </div>
                ` : `
                    <div class="variable-expenses-empty">
                        <span class="variable-empty-icon">
                            <i data-lucide="receipt-text"></i>
                        </span>
                        <h3>Nenhuma despesa cadastrada</h3>
                        <p>Quando você cadastrar uma despesa, ela aparecerá aqui.</p>
                        <button type="button" class="button-primary" data-expense-action="new">
                            <i data-lucide="plus"></i> Cadastrar primeira despesa
                        </button>
                    </div>
                `}

            </section>

            <div id="variableExpenseFormHost"></div>
        `;

        bindVariableExpensePage();
        refreshIcons();
    }

    // --------------------------------------------------
    // STATUS DA DESPESA
    // --------------------------------------------------

    function getExpenseStatus(installments) {
        if (!installments.length) {
            return {
                text: "🕗 Pendente",
                className: "expense-status-pending",
                key: "pending"
            };
        }

        if (installments.every((item) => item.paid)) {
            return {
                text: "✅ Paga",
                className: "expense-status-paid",
                key: "paid"
            };
        }

        const hasOverdue = installments.some(
            (item) => !item.paid && item.date && item.date < todayISO
        );

        if (hasOverdue) {
            return {
                text: "❌ Atrasado",
                className: "expense-status-overdue",
                key: "overdue"
            };
        }

        return {
            text: "🕗 Pendente",
            className: "expense-status-pending",
            key: "pending"
        };
    }

    // --------------------------------------------------
    // LINHA DA DESPESA
    // --------------------------------------------------

    function renderExpenseCard(expense) {
        const installments = [...(expense.installments || [])]
            .sort((a, b) => (a.date || "").localeCompare(b.date || ""));

        const paidCount = installments.filter((item) => item.paid).length;
        const status = getExpenseStatus(installments);

        const pendingAmount = installments
            .filter((item) => !item.paid)
            .reduce((sum, item) => sum + Number(item.amount || 0), 0);

        const paidAmount = installments
            .filter((item) => item.paid)
            .reduce((sum, item) => sum + Number(item.amount || 0), 0);

        const expenseId = escapeHTML(expense.id);
        const detailsId = `installments-${String(expense.id).replace(/[^a-zA-Z0-9_-]/g, "")}`;

        return `
            <article class="variable-expense-card">
                <div class="variable-expense-row">
                    <div class="variable-expense-row-name">
                        <strong>${escapeHTML(expense.name || "Despesa sem nome")}</strong>
                    </div>

                    <span class="variable-expense-status ${status.className}">
                        ${status.text}
                    </span>

                    <button
                        type="button"
                        class="button-secondary button-compact variable-expense-view-button"
                        data-expense-action="details"
                        data-expense-id="${expenseId}"
                        aria-expanded="false"
                        aria-controls="${detailsId}">
                        Ver →
                    </button>
                </div>

                <div class="variable-expense-installments" id="${detailsId}" hidden>
                    <div class="variable-expense-expanded-heading">
                        <div>
                            <h3>${escapeHTML(expense.name || "Despesa sem nome")}</h3>
                            <p>${escapeHTML(expense.company || "Empresa/fornecedor não informado")}</p>
                        </div>

                        <div class="variable-expense-expanded-total">
                            <span>Valor total</span>
                            <strong>${money(expense.totalAmount)}</strong>
                        </div>
                    </div>

                    <div class="variable-expense-expanded-summary">
                        <div>
                            <span>Tipo</span>
                            <strong>${expense.expenseType === "fixed" ? "Fixa" : "Variável"}</strong>
                        </div>
                        <div>
                            <span>Parcelas</span>
                            <strong>${installments.length}</strong>
                        </div>
                        <div>
                            <span>Valor pago</span>
                            <strong>${money(paidAmount)}</strong>
                        </div>
                        <div>
                            <span>Valor pendente</span>
                            <strong>${money(pendingAmount)}</strong>
                        </div>
                    </div>

                    <div class="installments-heading">
                        <strong>Parcelas e vencimentos</strong>
                        <span>${paidCount} de ${installments.length} pagas</span>
                    </div>

                    ${installments.length ? `
                        <div class="installments-table-wrap">
                            <table class="installments-table">
                                <thead>
                                    <tr>
                                        <th>Parcela</th>
                                        <th>Vencimento</th>
                                        <th>Status</th>
                                        <th class="align-right">Valor</th>
                                        <th>Ação</th>
                                    </tr>
                                </thead>

                                <tbody>
                                    ${installments.map((item) => {
            const overdue = !item.paid &&
                item.date &&
                item.date < todayISO;

            const installmentStatus = item.paid
                ? "paid"
                : overdue
                    ? "overdue"
                    : "pending";

            const installmentStatusText = item.paid
                ? "Paga"
                : overdue
                    ? "Atrasado"
                    : "Pendente";

            return `
                                            <tr class="${item.paid ? "installment-row-paid" : ""}">
                                                <td>${escapeHTML(item.label || "Parcela")}</td>
                                                <td>${dateLabel(item.date)}</td>
                                                <td>
                                                    <span class="badge ${installmentStatus === "paid"
                    ? "badge-paid"
                    : installmentStatus === "overdue"
                        ? "badge-overdue"
                        : "badge-pending"}">
                                                        ${installmentStatusText}
                                                    </span>
                                                </td>
                                                <td class="align-right money-value">${money(item.amount)}</td>
                                                <td>
                                                    ${item.paid ? `
                                                        <button
                                                            class="button-secondary button-compact"
                                                            type="button"
                                                            data-expense-action="unpay"
                                                            data-expense-id="${expenseId}"
                                                            data-installment-id="${escapeHTML(item.id)}">
                                                            Desfazer
                                                        </button>
                                                    ` : `
                                                        <button
                                                            class="button-primary button-compact"
                                                            type="button"
                                                            data-expense-action="pay"
                                                            data-expense-id="${expenseId}"
                                                            data-installment-id="${escapeHTML(item.id)}">
                                                            ✓ Marcar paga
                                                        </button>
                                                    `}
                                                </td>
                                            </tr>
                                        `;
        }).join("")}
                                </tbody>
                            </table>
                        </div>
                    ` : `
                        <div class="empty-state">
                            Esta despesa ainda não possui parcelas cadastradas.
                        </div>
                    `}

                    <div class="variable-expense-expanded-actions">
                        <button
                            type="button"
                            class="button-secondary button-compact button-danger"
                            data-expense-action="delete"
                            data-expense-id="${expenseId}">
                            <i data-lucide="trash-2"></i>
                            Excluir despesa
                        </button>
                    </div>
                </div>
            </article>
        `;
    }

    // --------------------------------------------------
    // AÇÕES DA LISTA DE DESPESAS
    // --------------------------------------------------

    function bindVariableExpensePage() {
        if (!expensesPage) return;

        expensesPage.querySelectorAll("[data-expense-filter]").forEach((button) => {
            button.addEventListener("click", () => {
                variableExpenseFilter = button.dataset.expenseFilter || "all";
                renderVariableExpensesPage();
            });
        });

        expensesPage.querySelectorAll("[data-expense-action]").forEach((button) => {
            button.addEventListener("click", () => {
                const action = button.dataset.expenseAction;
                const expenseId = button.dataset.expenseId;
                const installmentId = button.dataset.installmentId;

                if (action === "matrix") {
                    renderMatrixOptions();

                    if ($("#currentPage")) {
                        $("#currentPage").textContent = "Matriz";
                    }

                    return;
                }

                if (action === "new") {
                    renderExpenseForm();
                    return;
                }

                if (action === "details") {
                    const card = button.closest(".variable-expense-card");
                    const panel = card?.querySelector(".variable-expense-installments");

                    if (panel) {
                        panel.hidden = !panel.hidden;
                        button.textContent = panel.hidden ? "Ver →" : "Fechar";
                        button.setAttribute("aria-expanded", String(!panel.hidden));
                    }

                    refreshIcons();
                    return;
                }

                if (action === "pay" || action === "unpay") {
                    setInstallmentPaid(expenseId, installmentId, action === "pay");
                    return;
                }

                if (action === "delete") {
                    deleteExpense(expenseId);
                }
            });
        });
    }

    // --------------------------------------------------
    // FORMULÁRIO DE DESPESA
    // --------------------------------------------------

    function renderExpenseForm() {
        const host = $("#variableExpenseFormHost", expensesPage);
        if (!host) return;

        expenseFormDraft = {
            name: "",
            company: "",
            taxId: "",
            expenseType: "variable",
            totalAmount: "",
            installmentCount: 1,
            firstDate: todayISO,
            scheduleType: "monthly",
            fixedDay: String(Number(todayISO.slice(8, 10))),
            dates: [todayISO]
        };

        host.innerHTML = `
            <div class="expense-form-backdrop" data-form-backdrop>
                <section class="expense-form-modal" role="dialog" aria-modal="true"
                    aria-labelledby="variableExpenseFormTitle">

                    <div class="modal-heading">
                        <div>
                            <div class="eyebrow">MATRIZ / NOVO REGISTRO</div>
                            <h2 id="variableExpenseFormTitle">Cadastrar despesa</h2>
                            <p>Informe os dados da despesa e organize os vencimentos.</p>
                        </div>

                        <button type="button" class="icon-button"
                            data-form-action="cancel" aria-label="Fechar">
                            <i data-lucide="x"></i>
                        </button>
                    </div>

                    <form id="variableExpenseForm" novalidate>
                        <div class="expense-document-import"
                            style="margin-bottom:20px;padding:16px;border:1px dashed var(--border);border-radius:12px;background:rgba(59,130,246,.05)">

                            <div style="display:flex;align-items:center;gap:12px;flex-wrap:wrap">
                                <span style="display:flex;align-items:center;justify-content:center;width:42px;height:42px;border-radius:10px;background:rgba(59,130,246,.12);color:var(--blue-light)">
                                    <i data-lucide="file-up"></i>
                                </span>

                                <div style="flex:1;min-width:180px">
                                    <strong style="display:block;color:var(--text)">Leitura automática de documento</strong>
                                    <span style="display:block;margin-top:4px;color:var(--muted);font-size:12px">
                                        Envie uma conta ou boleto. O PRIME tentará preencher os dados encontrados no documento.
                                    </span>
                                </div>

                                <button type="button" class="button-secondary button-compact"
                                    id="importExpenseDocumentButton">
                                    <i data-lucide="upload"></i> Selecionar arquivo
                                </button>
                            </div>

                            <input id="expenseDocumentInput" type="file"
                                accept=".pdf,.png,.jpg,.jpeg,.webp,application/pdf,image/png,image/jpeg,image/webp" hidden>

                            <p id="expenseDocumentName"
                                style="margin:10px 0 0;color:var(--muted);font-size:12px"
                                hidden></p>

                            <p id="expenseDocumentStatus"
                                role="status" aria-live="polite"
                                style="margin:8px 0 0;color:var(--blue-light);font-size:12px"
                                hidden></p>

                            <p style="margin:10px 0 0;color:var(--muted);font-size:11px">
                                O documento é processado no navegador. Confira os dados preenchidos antes de salvar.
                            </p>
                        </div>

                        <div class="expense-form-grid">
                            <label class="form-field form-field-full">
                                Nome da despesa *
                                <input name="name" type="text" maxlength="120" required
                                    placeholder="Ex.: Conta de energia elétrica">
                            </label>

                            <label class="form-field">
                                Nome da empresa / fornecedor *
                                <input name="company" type="text" maxlength="120" required
                                    placeholder="Nome da empresa">
                            </label>

                            <label class="form-field">
                                CNPJ ou CPF
                                <input name="taxId" type="text" maxlength="18"
                                    placeholder="00.000.000/0000-00 ou CPF">
                            </label>

                            <label class="form-field">
                                Tipo de despesa *
                                <select name="expenseType" required>
                                    <option value="variable">Variável</option>
                                    <option value="fixed">Fixa</option>
                                </select>
                            </label>

                            <label class="form-field">
                                Valor total (R$) *
                                <input name="totalAmount" type="number" min="0.01"
                                    step="0.01" required placeholder="0,00">
                            </label>

                            <label class="form-field">
                                É parcelada? *
                                <select name="isInstallment" required>
                                    <option value="no">Não, pagamento à vista</option>
                                    <option value="yes">Sim, parcelar</option>
                                </select>
                            </label>

                            <label class="form-field" id="installmentCountField" hidden>
                                Quantidade de parcelas *
                                <input name="installmentCount" type="number" min="2"
                                    max="120" step="1" value="2">
                            </label>

                            <label class="form-field">
                                Data do pagamento / 1º vencimento *
                                <input name="firstDate" type="date"
                                    value="${todayISO}" required>
                            </label>
                        </div>

                        <div class="expense-schedule-box" id="expenseScheduleBox" hidden>
                            <div class="expense-schedule-title">
                                <i data-lucide="calendar-clock"></i>
                                <div>
                                    <strong>Como serão os vencimentos?</strong>
                                    <span>Escolha como as parcelas serão distribuídas.</span>
                                </div>
                            </div>

                            <div class="expense-schedule-options">
                                <label class="expense-radio-option">
                                    <input type="radio" name="scheduleType" value="monthly" checked>
                                    <span>
                                        <strong>Todo mês no mesmo dia</strong>
                                        <small>Ex.: todo dia 10 de cada mês.</small>
                                    </span>
                                </label>

                                <label class="expense-radio-option">
                                    <input type="radio" name="scheduleType" value="different">
                                    <span>
                                        <strong>Datas diferentes</strong>
                                        <small>Informe o vencimento de cada parcela.</small>
                                    </span>
                                </label>
                            </div>

                            <div class="form-field" id="fixedDayField">
                                Dia do mês para vencimento
                                <select name="fixedDay">
                                    ${Array.from({ length: 31 }, (_, index) => {
            const day = index + 1;
            return `
                                            <option value="${day}"
                                                ${day === Number(todayISO.slice(8, 10)) ? "selected" : ""}>
                                                Dia ${day}
                                            </option>
                                        `;
        }).join("")}
                                </select>

                                <small class="field-hint">
                                    Se o mês não tiver esse dia, será usado o último dia do mês.
                                </small>
                            </div>

                            <div id="differentDatesFields" hidden></div>
                        </div>

                        <p class="form-note">
                            A despesa será considerada nos compromissos financeiros conforme seus vencimentos.
                            O saldo efetivo só será reduzido quando a parcela for marcada como paga.
                        </p>

                        <div class="modal-actions">
                            <button type="button" class="button-secondary" data-form-action="cancel">
                                Cancelar
                            </button>

                            <button type="submit" class="button-primary">
                                <i data-lucide="save"></i> Salvar despesa
                            </button>
                        </div>
                    </form>
                </section>
            </div>
        `;

        bindExpenseForm();
        bindExpenseDocumentImport();
        refreshIcons();

        $('input[name="name"]', host)?.focus();
    }

    // --------------------------------------------------
    // LEITURA DE PDF E OCR
    // --------------------------------------------------

    const documentLibraryPromises = {};

    function loadDocumentLibrary(name, url, isLoaded) {
        if (isLoaded()) return Promise.resolve();

        if (documentLibraryPromises[name]) {
            return documentLibraryPromises[name];
        }

        documentLibraryPromises[name] = new Promise((resolve, reject) => {
            const script = document.createElement("script");
            script.src = url;
            script.async = true;

            script.onload = () => {
                if (isLoaded()) {
                    resolve();
                } else {
                    delete documentLibraryPromises[name];
                    reject(new Error(`A biblioteca ${name} não foi carregada corretamente.`));
                }
            };

            script.onerror = () => {
                delete documentLibraryPromises[name];
                reject(new Error(`Não foi possível carregar ${name}. Verifique a conexão com a internet.`));
            };

            document.head.appendChild(script);
        });

        return documentLibraryPromises[name];
    }

    async function getPDFLibrary() {
        await loadDocumentLibrary(
            "PDF.js",
            "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js",
            () => Boolean(window.pdfjsLib)
        );

        window.pdfjsLib.GlobalWorkerOptions.workerSrc =
            "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js";

        return window.pdfjsLib;
    }

    async function getOCRLibrary() {
        await loadDocumentLibrary(
            "Tesseract.js",
            "https://cdn.jsdelivr.net/npm/tesseract.js@5/dist/tesseract.min.js",
            () => Boolean(window.Tesseract)
        );

        return window.Tesseract;
    }

    function updateDocumentStatus(message, isError = false) {
        const host = $("#variableExpenseFormHost", expensesPage);
        const status = $("#expenseDocumentStatus", host);

        if (!status) return;

        status.textContent = message;
        status.hidden = !message;
        status.style.color = isError ? "#F87171" : "var(--blue-light)";
    }

    async function readPDFText(file, onProgress) {
        const pdfjs = await getPDFLibrary();
        const buffer = await file.arrayBuffer();

        const pdf = await pdfjs.getDocument({
            data: new Uint8Array(buffer)
        }).promise;

        let fullText = "";
        const pagesToRead = Math.min(pdf.numPages, 5);

        for (let pageNumber = 1; pageNumber <= pagesToRead; pageNumber++) {
            onProgress(`Lendo texto do PDF: página ${pageNumber} de ${pagesToRead}...`);

            const page = await pdf.getPage(pageNumber);
            const content = await page.getTextContent();

            fullText += "\n" + content.items
                .map((item) => item.str || "")
                .join(" ");
        }

        if (fullText.replace(/\s/g, "").length >= 30) {
            return fullText;
        }

        // PDF escaneado: transforma as páginas em imagem para executar OCR.
        const ocr = await getOCRLibrary();
        let ocrText = "";

        const pagesForOCR = Math.min(pdf.numPages, 3);

        for (let pageNumber = 1; pageNumber <= pagesForOCR; pageNumber++) {
            onProgress(`O PDF é escaneado. Reconhecendo texto da página ${pageNumber} de ${pagesForOCR}...`);

            const page = await pdf.getPage(pageNumber);
            const viewport = page.getViewport({ scale: 1.6 });
            const canvas = document.createElement("canvas");
            const context = canvas.getContext("2d");

            if (!context) {
                throw new Error("Não foi possível preparar a imagem do PDF para leitura.");
            }

            canvas.width = Math.ceil(viewport.width);
            canvas.height = Math.ceil(viewport.height);

            await page.render({
                canvasContext: context,
                viewport
            }).promise;

            const result = await ocr.recognize(canvas, "por+eng", {
                logger: (info) => {
                    if (info.status === "recognizing text" && info.progress) {
                        onProgress(
                            `Reconhecendo texto da página ${pageNumber}: ${Math.round(info.progress * 100)}%`
                        );
                    }
                }
            });

            ocrText += "\n" + (result.data?.text || "");
            canvas.width = 1;
            canvas.height = 1;
        }

        return ocrText || fullText;
    }

    async function readImageText(file, onProgress) {
        const ocr = await getOCRLibrary();

        onProgress("Preparando imagem para reconhecimento de texto...");

        const result = await ocr.recognize(file, "por+eng", {
            logger: (info) => {
                if (info.status === "recognizing text" && info.progress) {
                    onProgress(`Reconhecendo texto: ${Math.round(info.progress * 100)}%`);
                } else if (info.status === "loading language traineddata") {
                    onProgress("Carregando idioma para leitura do documento...");
                }
            }
        });

        return result.data?.text || "";
    }

    async function readExpenseDocument(file, onProgress) {
        const isPDF =
            file.type === "application/pdf" ||
            /\.pdf$/i.test(file.name);

        if (isPDF) {
            return readPDFText(file, onProgress);
        }

        if (/^image\/(png|jpeg|webp)$/i.test(file.type) ||
            /\.(png|jpe?g|webp)$/i.test(file.name)) {
            return readImageText(file, onProgress);
        }

        throw new Error("Formato não suportado. Selecione um PDF, PNG, JPG ou WEBP.");
    }

    // --------------------------------------------------
    // EXTRAÇÃO DOS DADOS DO DOCUMENTO
    // --------------------------------------------------

    function normalizeDocumentText(value) {
        return String(value || "")
            .normalize("NFD")
            .replace(/[\u0300-\u036f]/g, "")
            .toLowerCase();
    }

    function extractDocumentAmount(text) {
        const lines = String(text || "")
            .split(/\r?\n/)
            .map((line) => line.trim())
            .filter(Boolean);

        const labels = [
            /total\s+a\s+pagar/i,
            /valor\s+total/i,
            /valor\s+a\s+pagar/i,
            /valor\s+do\s+documento/i,
            /valor\s+da\s+fatura/i,
            /total\s+da\s+fatura/i,
            /valor\s+cobrado/i,
            /valor\s+final/i,
            /total\s+geral/i,
            /valor\s+do\s+boleto/i
        ];

        const moneyRegex =
            /(?:R\$\s*)?(\d{1,3}(?:\.\d{3})+,\d{2}|\d+,\d{2}|\d{1,3}(?:,\d{3})+\.\d{2}|\d+\.\d{2})/g;

        function parseAmount(value) {
            let normalized = String(value).trim().replace(/\s/g, "");

            if (normalized.includes(",")) {
                normalized = normalized.replace(/\./g, "").replace(",", ".");
            }

            const amount = Number(normalized);

            return Number.isFinite(amount) && amount > 0
                ? amount
                : null;
        }

        // Procura primeiro valores próximos de rótulos financeiros relevantes.
        for (let index = 0; index < lines.length; index++) {
            if (!labels.some((label) => label.test(lines[index]))) continue;

            const nearby = [
                lines[index],
                lines[index + 1] || "",
                lines[index - 1] || ""
            ].join(" ");

            const matches = [...nearby.matchAll(moneyRegex)];

            for (const match of matches) {
                const amount = parseAmount(match[1]);
                if (amount !== null) return amount;
            }
        }

        return null;
    }

    function extractDocumentDueDate(text) {
        const lines = String(text || "")
            .split(/\r?\n/)
            .map((line) => line.trim())
            .filter(Boolean);

        const dateRegex =
            /\b(\d{2})[\/.-](\d{2})[\/.-](\d{4})\b|\b(\d{4})-(\d{2})-(\d{2})\b/g;

        const dueDateLabels =
            /vencimento|data\s+de\s+vencimento|pagar\s+ate|pague\s+ate|venc\./i;

        for (let index = 0; index < lines.length; index++) {
            if (!dueDateLabels.test(lines[index])) continue;

            const nearby = [
                lines[index],
                lines[index + 1] || "",
                lines[index - 1] || ""
            ].join(" ");

            const matches = [...nearby.matchAll(dateRegex)];

            for (const match of matches) {
                let year;
                let month;
                let day;

                if (match[1]) {
                    day = Number(match[1]);
                    month = Number(match[2]);
                    year = Number(match[3]);
                } else {
                    year = Number(match[4]);
                    month = Number(match[5]);
                    day = Number(match[6]);
                }

                const date = new Date(year, month - 1, day);

                if (
                    date.getFullYear() === year &&
                    date.getMonth() === month - 1 &&
                    date.getDate() === day
                ) {
                    return [
                        year,
                        String(month).padStart(2, "0"),
                        String(day).padStart(2, "0")
                    ].join("-");
                }
            }
        }

        return "";
    }

    function extractDocumentCNPJ(text) {
        const lines = String(text || "").split(/\r?\n/);

        for (let index = 0; index < lines.length; index++) {
            if (!/CNPJ/i.test(lines[index])) continue;

            const nearby = [
                lines[index],
                lines[index + 1] || ""
            ].join(" ");

            const match = nearby.match(
                /\b\d{2}\.?\d{3}\.?\d{3}\/?\d{4}-?\d{2}\b/
            );

            if (match) {
                const digits = match[0].replace(/\D/g, "");

                if (digits.length === 14) {
                    return digits;
                }
            }
        }

        return "";
    }

    function identifyDocumentProvider(text, fileName) {
        const source = normalizeDocumentText(`${text}\n${fileName || ""}`);

        const providers = [
            { pattern: /\bcopel\b/, name: "COPEL" },
            { pattern: /\bsanepar\b/, name: "SANEPAR" },
            { pattern: /\bcelesc\b/, name: "CELESC" },
            { pattern: /\bcemig\b/, name: "CEMIG" },
            { pattern: /\benel\b/, name: "ENEL" },
            { pattern: /\bneoenergia\b/, name: "NEOENERGIA" },
            { pattern: /\bcpfl\b/, name: "CPFL" },
            { pattern: /\bequatorial\b/, name: "EQUATORIAL" },
            { pattern: /\benergisa\b/, name: "ENERGISA" },
            { pattern: /\bclaro\b/, name: "CLARO" },
            { pattern: /\bvivo\b/, name: "VIVO" },
            { pattern: /\btim\b/, name: "TIM" },
            { pattern: /\btelefonica\b/, name: "TELEFÔNICA" },
            { pattern: /\boi\s+(fibra|telecom)\b/, name: "OI" }
        ];

        return providers.find((provider) => provider.pattern.test(source))?.name || "";
    }

    function identifyDocumentDescription(text, fileName) {
        const source = normalizeDocumentText(text);

        if (/energia eletrica|consumo de energia|unidade consumidora/.test(source)) {
            return "Conta de energia elétrica";
        }

        if (/saneamento|abastecimento de agua|conta de agua|esgoto/.test(source)) {
            return "Conta de água e saneamento";
        }

        if (/internet|banda larga|fibra optica/.test(source)) {
            return "Internet";
        }

        if (/telefonia movel|plano movel|servicos de telefonia/.test(source)) {
            return "Telefonia";
        }

        if (/boleto bancario|ficha de compensacao/.test(source)) {
            return "Pagamento de boleto";
        }

        const cleanedName = String(fileName || "")
            .replace(/\.[^.]+$/, "")
            .replace(/[_-]+/g, " ")
            .replace(/\s+/g, " ")
            .trim();

        if (cleanedName && cleanedName.length <= 100) {
            return `Despesa - ${cleanedName}`;
        }

        return "";
    }

    function extractExpenseDocumentData(text, fileName) {
        const provider = identifyDocumentProvider(text, fileName);

        return {
            name: identifyDocumentDescription(text, fileName),
            company: provider,
            taxId: extractDocumentCNPJ(text),
            totalAmount: extractDocumentAmount(text),
            firstDate: extractDocumentDueDate(text)
        };
    }

    function fillExpenseFormFromDocument(form, data) {
        const filled = [];

        // Só preenche campos vazios para preservar o que o usuário já digitou.
        if (data.name && !form.elements.name.value.trim()) {
            form.elements.name.value = data.name;
            filled.push("descrição");
        }

        if (data.company && !form.elements.company.value.trim()) {
            form.elements.company.value = data.company;
            filled.push("fornecedor");
        }

        if (data.taxId && !form.elements.taxId.value.trim()) {
            form.elements.taxId.value = formatTaxId(data.taxId);
            filled.push("CNPJ");
        }

        if (
            data.totalAmount !== null &&
            data.totalAmount !== undefined &&
            !form.elements.totalAmount.value
        ) {
            form.elements.totalAmount.value = Number(data.totalAmount).toFixed(2);
            filled.push("valor");
        }

        if (data.firstDate && !form.elements.firstDate.value) {
            form.elements.firstDate.value = data.firstDate;
            filled.push("vencimento");
        }

        return filled;
    }

    // --------------------------------------------------
    // IMPORTAÇÃO DE DOCUMENTOS
    // --------------------------------------------------

    function bindExpenseDocumentImport() {
        const host = $("#variableExpenseFormHost", expensesPage);
        if (!host) return;

        const button = $("#importExpenseDocumentButton", host);
        const fileInput = $("#expenseDocumentInput", host);
        const fileName = $("#expenseDocumentName", host);

        if (!button || !fileInput || !fileName) return;

        button.addEventListener("click", () => {
            fileInput.click();
        });

        fileInput.addEventListener("change", async () => {
            const file = fileInput.files?.[0];

            if (!file) {
                fileName.hidden = true;
                fileName.textContent = "";
                updateDocumentStatus("");
                return;
            }

            const allowedExtensions = /\.(pdf|png|jpe?g|webp)$/i;

            if (!allowedExtensions.test(file.name)) {
                fileInput.value = "";
                fileName.hidden = true;
                updateDocumentStatus("Formato inválido. Escolha PDF, PNG, JPG ou WEBP.", true);
                showToast("Selecione um PDF ou uma imagem válida.");
                return;
            }

            if (file.size > 20 * 1024 * 1024) {
                fileInput.value = "";
                updateDocumentStatus("O arquivo excede o limite de 20 MB.", true);
                showToast("Selecione um arquivo de até 20 MB.");
                return;
            }

            const form = $("#variableExpenseForm", host);

            if (!form) return;

            button.disabled = true;
            button.innerHTML = '<i data-lucide="loader-circle"></i> Lendo documento';

            fileName.textContent = `Arquivo selecionado: ${file.name}`;
            fileName.hidden = false;

            updateDocumentStatus("Iniciando leitura do documento...");

            try {
                const text = await readExpenseDocument(file, (message) => {
                    updateDocumentStatus(message);
                });

                if (!$("#variableExpenseForm", host)) return;

                if (!text || text.replace(/\s/g, "").length < 10) {
                    updateDocumentStatus(
                        "Não foi possível reconhecer texto suficiente. Tente um PDF com melhor qualidade ou uma imagem mais nítida.",
                        true
                    );

                    showToast("Não foi possível ler os dados deste documento.");
                    return;
                }

                const data = extractExpenseDocumentData(text, file.name);
                const filled = fillExpenseFormFromDocument(form, data);

                if (filled.length) {
                    updateDocumentStatus(
                        `Leitura concluída. Campos preenchidos: ${filled.join(", ")}. Confira os dados antes de salvar.`
                    );

                    showToast("Documento lido. Confira os campos preenchidos.");
                } else {
                    updateDocumentStatus(
                        "Documento lido, mas nenhum campo vazio pôde ser preenchido com segurança. Confira o documento e preencha os dados manualmente.",
                        true
                    );

                    showToast("Leitura concluída. Confira os dados manualmente.");
                }
            } catch (error) {
                console.error("Erro ao ler documento da despesa:", error);

                updateDocumentStatus(
                    error.message || "Ocorreu um erro ao ler o documento. Tente novamente.",
                    true
                );

                showToast("Não foi possível ler o documento.");
            } finally {
                button.disabled = false;
                button.innerHTML = '<i data-lucide="upload"></i> Selecionar arquivo';
                refreshIcons();
            }
        });
    }

    // --------------------------------------------------
    // FORMULÁRIO DE DESPESA: EVENTOS
    // --------------------------------------------------

    function bindExpenseForm() {
        const host = $("#variableExpenseFormHost", expensesPage);
        const form = $("#variableExpenseForm", host);

        if (!form) return;

        const isInstallmentSelect = form.elements.isInstallment;
        const countField = $("#installmentCountField", form);
        const scheduleBox = $("#expenseScheduleBox", form);
        const fixedDayField = $("#fixedDayField", form);
        const differentDatesFields = $("#differentDatesFields", form);

        function updateInstallmentVisibility() {
            const isInstallment = isInstallmentSelect.value === "yes";

            countField.hidden = !isInstallment;
            scheduleBox.hidden = !isInstallment;
            form.elements.installmentCount.required = isInstallment;

            if (!isInstallment) {
                form.elements.installmentCount.value = "1";
            } else if (Number(form.elements.installmentCount.value) < 2) {
                form.elements.installmentCount.value = "2";
            }

            updateScheduleVisibility();
        }

        function updateScheduleVisibility() {
            const isInstallment = isInstallmentSelect.value === "yes";

            const scheduleType =
                form.querySelector('input[name="scheduleType"]:checked')?.value ||
                "monthly";

            fixedDayField.hidden = !isInstallment || scheduleType !== "monthly";
            differentDatesFields.hidden =
                !isInstallment || scheduleType !== "different";

            if (isInstallment && scheduleType === "different") {
                renderDifferentDateInputs();
            } else {
                differentDatesFields.innerHTML = "";
            }
        }

        function renderDifferentDateInputs() {
            const count = Math.max(
                2,
                Math.min(120, Number(form.elements.installmentCount.value) || 2)
            );

            const firstDate = form.elements.firstDate.value || todayISO;

            const existingDates = [
                ...differentDatesFields.querySelectorAll('input[name="installmentDate"]')
            ].map((input) => input.value);

            const dates = Array.from({ length: count }, (_, index) =>
                existingDates[index] || (index === 0 ? firstDate : "")
            );

            differentDatesFields.innerHTML = `
                <div class="different-dates-heading">
                    <strong>Datas de cada parcela</strong>
                    <span>Preencha todos os vencimentos.</span>
                </div>

                <div class="different-dates-grid">
                    ${dates.map((date, index) => `
                        <label class="form-field">
                            ${index + 1}ª parcela *
                            <input type="date" name="installmentDate"
                                required value="${escapeHTML(date)}">
                        </label>
                    `).join("")}
                </div>
            `;
        }

        isInstallmentSelect.addEventListener("change", updateInstallmentVisibility);

        form.elements.installmentCount.addEventListener("input", () => {
            if (
                isInstallmentSelect.value === "yes" &&
                form.querySelector('input[name="scheduleType"]:checked')?.value === "different"
            ) {
                renderDifferentDateInputs();
            }
        });

        form.elements.firstDate.addEventListener("change", () => {
            if (
                form.querySelector('input[name="scheduleType"]:checked')?.value === "different"
            ) {
                renderDifferentDateInputs();
            }
        });

        form.querySelectorAll('input[name="scheduleType"]').forEach((radio) => {
            radio.addEventListener("change", updateScheduleVisibility);
        });

        host.querySelectorAll('[data-form-action="cancel"]').forEach((button) => {
            button.addEventListener("click", closeExpenseForm);
        });

        host.querySelector("[data-form-backdrop]")?.addEventListener("click", (event) => {
            if (event.target.matches("[data-form-backdrop]")) {
                closeExpenseForm();
            }
        });

        form.elements.taxId.addEventListener("input", () => {
            form.elements.taxId.value = formatTaxId(form.elements.taxId.value);
        });

        form.addEventListener("submit", (event) => {
            event.preventDefault();
            saveExpenseForm(form);
        });

        updateInstallmentVisibility();
    }

    function formatTaxId(value) {
        const digits = String(value).replace(/\D/g, "").slice(0, 14);

        if (digits.length <= 11) {
            return digits
                .replace(/^(\d{3})(\d)/, "$1.$2")
                .replace(/^(\d{3})\.(\d{3})(\d)/, "$1.$2.$3")
                .replace(/\.(\d{3})(\d)/, ".$1-$2");
        }

        return digits
            .replace(/^(\d{2})(\d)/, "$1.$2")
            .replace(/^(\d{2})\.(\d{3})(\d)/, "$1.$2.$3")
            .replace(/\.(\d{3})(\d)/, ".$1/$2")
            .replace(/(\d{4})(\d)/, "$1-$2");
    }

    function closeExpenseForm() {
        const host = $("#variableExpenseFormHost", expensesPage);

        if (host) {
            host.innerHTML = "";
        }

        expenseFormDraft = null;
    }

    // --------------------------------------------------
    // PARCELAMENTO E VALORES
    // --------------------------------------------------

    function addMonthsKeepingDay(dateString, monthOffset, preferredDay) {
        const [year, month] = dateString.split("-").map(Number);

        const targetMonth = month - 1 + monthOffset;
        const targetYear = year + Math.floor(targetMonth / 12);
        const normalizedMonth = ((targetMonth % 12) + 12) % 12;

        const lastDay = new Date(
            targetYear,
            normalizedMonth + 1,
            0
        ).getDate();

        const day = Math.min(Number(preferredDay) || 1, lastDay);

        return [
            targetYear,
            String(normalizedMonth + 1).padStart(2, "0"),
            String(day).padStart(2, "0")
        ].join("-");
    }

    function splitAmount(total, count) {
        const totalCents = Math.round(Number(total) * 100);
        const base = Math.floor(totalCents / count);
        const remainder = totalCents - (base * count);

        return Array.from({ length: count }, (_, index) =>
            (base + (index < remainder ? 1 : 0)) / 100
        );
    }

    function saveExpenseForm(form) {
        const formData = new FormData(form);

        const name = String(formData.get("name") || "").trim();
        const company = String(formData.get("company") || "").trim();
        const taxId = String(formData.get("taxId") || "").trim();
        const expenseType = String(formData.get("expenseType") || "variable");
        const totalAmount = Number(formData.get("totalAmount"));
        const firstDate = String(formData.get("firstDate") || "");
        const isInstallment = formData.get("isInstallment") === "yes";

        const installmentCount = isInstallment
            ? Number(formData.get("installmentCount"))
            : 1;

        if (
            !name ||
            !company ||
            !firstDate ||
            !Number.isFinite(totalAmount) ||
            totalAmount <= 0
        ) {
            showToast("Preencha os campos obrigatórios e confira o valor.");
            return;
        }

        if (!["fixed", "variable"].includes(expenseType)) {
            showToast("Selecione o tipo de despesa.");
            return;
        }

        if (
            !Number.isInteger(installmentCount) ||
            installmentCount < 1 ||
            installmentCount > 120
        ) {
            showToast("Informe uma quantidade de parcelas entre 1 e 120.");
            return;
        }

        let dates = [];

        if (!isInstallment) {
            dates = [firstDate];
        } else {
            const scheduleType = String(formData.get("scheduleType") || "monthly");

            if (scheduleType === "monthly") {
                const fixedDay =
                    Number(formData.get("fixedDay")) ||
                    Number(firstDate.slice(8, 10));

                dates = Array.from(
                    { length: installmentCount },
                    (_, index) => addMonthsKeepingDay(firstDate, index, fixedDay)
                );

                dates[0] = firstDate;
            } else {
                dates = [
                    ...form.querySelectorAll('input[name="installmentDate"]')
                ].map((input) => input.value);

                if (dates.length !== installmentCount || dates.some((date) => !date)) {
                    showToast("Informe a data de vencimento de todas as parcelas.");
                    return;
                }

                if (dates.some((date) => date < firstDate)) {
                    showToast("As datas das parcelas não podem ser anteriores ao primeiro vencimento.");
                    return;
                }

                if (new Set(dates).size !== dates.length) {
                    showToast("Existem parcelas com a mesma data. Confira os vencimentos.");
                    return;
                }
            }
        }

        const amounts = splitAmount(totalAmount, installmentCount);

        const installments = dates.map((date, index) => ({
            id: `${Date.now()}-${index}-${Math.random().toString(36).slice(2, 7)}`,
            number: index + 1,
            label: installmentCount > 1
                ? `${index + 1}/${installmentCount}`
                : "Pagamento único",
            date,
            amount: amounts[index],
            paid: false,
            paidAt: null
        }));

        const expense = {
            id: `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
            name,
            company,
            taxId,
            expenseType,
            totalAmount: Math.round(totalAmount * 100) / 100,
            installmentCount,
            createdAt: new Date().toISOString(),
            installments
        };

        variableExpenses.push(expense);

        if (!persistVariableExpenses()) {
            variableExpenses = variableExpenses.filter(
                (item) => item.id !== expense.id
            );
            return;
        }

        closeExpenseForm();
        renderVariableExpensesPage();
        updateDashboard();
        showToast("Despesa cadastrada com sucesso.");
    }

    // --------------------------------------------------
    // MARCAR PARCELA COMO PAGA
    // --------------------------------------------------

    function setInstallmentPaid(expenseId, installmentId, paid) {
        const expense = variableExpenses.find((item) => item.id === expenseId);

        const installment = expense?.installments?.find(
            (item) => item.id === installmentId
        );

        if (!expense || !installment) {
            showToast("Não foi possível localizar essa parcela.");
            return;
        }

        const previousPaid = installment.paid;
        const previousPaidAt = installment.paidAt;

        installment.paid = paid;
        installment.paidAt = paid ? new Date().toISOString() : null;

        if (!persistVariableExpenses()) {
            installment.paid = previousPaid;
            installment.paidAt = previousPaidAt;
            return;
        }

        renderVariableExpensesPage();
        updateDashboard();

        showToast(
            paid
                ? "✓ Parcela marcada como paga."
                : "Pagamento desfeito."
        );
    }

    // --------------------------------------------------
    // EXCLUIR DESPESA
    // --------------------------------------------------

    function deleteExpense(expenseId) {
        const expense = variableExpenses.find((item) => item.id === expenseId);
        if (!expense) return;

        const confirmed = window.confirm(
            `Deseja excluir a despesa "${expense.name}" e todas as suas parcelas?`
        );

        if (!confirmed) return;

        const previous = variableExpenses;

        variableExpenses = variableExpenses.filter(
            (item) => item.id !== expenseId
        );

        if (!persistVariableExpenses()) {
            variableExpenses = previous;
            return;
        }

        renderVariableExpensesPage();
        updateDashboard();
        showToast("Despesa excluída.");
    }

    // --------------------------------------------------
    // EVENTOS DA NAVEGAÇÃO
    // --------------------------------------------------

    $$(".nav-item").forEach((item) => {
        item.addEventListener("click", (event) => {
            if (item.getAttribute("href") === "./developer.html") return;
            event.preventDefault();

            const pageName = item.dataset.page;

            setActiveNavigation(pageName);
            closeSidebar();

            if (pageName === "Dashboard") {
                showDashboard();
                return;
            }

            if (pageName === "Despesas") {
                showExpensesPage();
                return;
            }

            if (pageName === "Receitas") {
                showRevenuePage();
                return;
            }

            restoreDashboardContent();

            if ($("#currentPage")) {
                $("#currentPage").textContent = pageName;
            }

            const targets = {
                "Contas a pagar": "#payables",
                "Receitas": "#revenue",
                "Fluxo de caixa": "#cash-flow"
            };

            const target = targets[pageName];

            if (target && $(target)) {
                $(target).scrollIntoView({
                    behavior: "smooth",
                    block: "start"
                });
                return;
            }

            showToast(`Módulo "${pageName}" reservado para a próxima etapa.`);
        });
    });

    $$("[data-page]")
        .filter((item) => !item.classList.contains("nav-item"))
        .forEach((item) => {
            item.addEventListener("click", (event) => {
                event.preventDefault();

                const pageName = item.dataset.page;

                if (pageName === "Contas a pagar") {
                    setActiveNavigation(pageName);
                    closeSidebar();
                    restoreDashboardContent();

                    if ($("#currentPage")) {
                        $("#currentPage").textContent = pageName;
                    }

                    $("#payables")?.scrollIntoView({
                        behavior: "smooth",
                        block: "start"
                    });
                    return;
                }

                showToast(`O módulo "${pageName}" será implementado na próxima etapa.`);
            });
        });

    // --------------------------------------------------
    // MENU RESPONSIVO
    // --------------------------------------------------

    if (menuToggle && sidebar) {
        menuToggle.addEventListener("click", () => {
            const isOpen = sidebar.classList.toggle("open");
            menuToggle.setAttribute("aria-expanded", String(isOpen));
        });

        document.addEventListener("click", (event) => {
            if (
                window.innerWidth <= 900 &&
                sidebar.classList.contains("open") &&
                !sidebar.contains(event.target) &&
                !menuToggle.contains(event.target)
            ) {
                closeSidebar();
            }
        });

        window.addEventListener("resize", () => {
            if (window.innerWidth > 900) {
                closeSidebar();
            }
        });
    }

    // --------------------------------------------------
    // BUSCA
    // --------------------------------------------------

    const globalSearch = $("#globalSearch");

    if (globalSearch) {
        globalSearch.addEventListener("input", () => {
            renderTransactions();

            const query = globalSearch.value
                .trim()
                .toLocaleLowerCase("pt-BR");

            $$("[data-search]").forEach((item) => {
                const text = (item.dataset.search || "")
                    .toLocaleLowerCase("pt-BR");

                item.hidden = query.length > 0 && !text.includes(query);
            });
        });
    }

    // --------------------------------------------------
    // FILTRO DO FLUXO DE CAIXA
    // --------------------------------------------------

    $("#cashflowPeriod")?.addEventListener("change", (event) => {
        initCashflowChart(Number(event.target.value));
    });

    // --------------------------------------------------
    // ATALHOS, NOTIFICAÇÕES E ATUALIZAÇÃO
    // --------------------------------------------------

    document.addEventListener("keydown", (event) => {
        if (
            (event.metaKey || event.ctrlKey) &&
            event.key.toLowerCase() === "k"
        ) {
            event.preventDefault();
            globalSearch?.focus();
        }
    });

    $("#notificationButton")?.addEventListener("click", () => {
        const pending = getInstallments().filter((item) => !item.paid).length;

        showToast(
            pending
                ? `Você tem ${pending} parcela(s) pendente(s).`
                : "Não há notificações registradas."
        );
    });

    $("#refreshTransactions")?.addEventListener("click", () => {
        updateDashboard();
        showToast("Indicadores atualizados.");
    });

    // --------------------------------------------------
    // INTEGRAÇÃO REATIVA DA FOLHA COM O DASHBOARD
    // --------------------------------------------------

    window.addEventListener("prime:payroll-updated", () => {
        updateDashboard();
    });

    // --------------------------------------------------
    // INICIALIZAÇÃO
    // --------------------------------------------------

    updateDashboard();
    refreshIcons();
});

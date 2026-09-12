/* H&M Supplier Qty Indication Portal — application logic */
(function () {
  "use strict";

  var STORAGE_KEY = "hm_sqip_data_v1";
  var SESSION_KEY = "hm_sqip_session_v1";

  /* ---------------------------------------------------------------- */
  /* Seed data / persistence                                          */
  /* ---------------------------------------------------------------- */

  function seedData() {
    return {
      users: [
        { username: "admin", password: "admin123", role: "admin", name: "H&M Admin" },
        { username: "supplier1", password: "supplier123", role: "supplier", name: "Bengal Textiles Ltd.", supplierId: "SUP-001" },
        { username: "supplier2", password: "supplier123", role: "supplier", name: "Dhaka Garments Co.", supplierId: "SUP-002" },
      ],
      suppliers: [
        { id: "SUP-001", name: "Bengal Textiles Ltd.", country: "Bangladesh", contact: "contact@bengaltex.example" },
        { id: "SUP-002", name: "Dhaka Garments Co.", country: "Bangladesh", contact: "sales@dhakagarments.example" },
        { id: "SUP-003", name: "Guangzhou Apparel Group", country: "China", contact: "info@gzapparel.example" },
      ],
      deals: [
        { id: "DEAL-1001", style: "H&M-8834", description: "Men's Slim Fit Denim Jacket", season: "AW26", color: "Indigo Blue", targetQty: 25000, deadline: "2026-10-15" },
        { id: "DEAL-1002", style: "H&M-9021", description: "Women's Ribbed Knit Sweater", season: "AW26", color: "Charcoal", targetQty: 40000, deadline: "2026-10-20" },
        { id: "DEAL-1003", style: "H&M-7745", description: "Kids Fleece Hoodie", season: "AW26", color: "Forest Green", targetQty: 18000, deadline: "2026-11-01" },
        { id: "DEAL-1004", style: "H&M-6612", description: "Men's Cotton Chinos", season: "SS27", color: "Sand Beige", targetQty: 32000, deadline: "2026-12-05" },
        { id: "DEAL-1005", style: "H&M-5590", description: "Women's Linen Blend Dress", season: "SS27", color: "Ivory White", targetQty: 21000, deadline: "2026-12-10" },
      ],
      indications: [
        { dealId: "DEAL-1001", supplierId: "SUP-001", indicatedQty: 12000, status: "approved", submittedAt: "2026-09-01T10:00:00Z" },
        { dealId: "DEAL-1001", supplierId: "SUP-002", indicatedQty: 9000, status: "pending", submittedAt: "2026-09-03T10:00:00Z" },
        { dealId: "DEAL-1002", supplierId: "SUP-001", indicatedQty: 15000, status: "pending", submittedAt: "2026-09-02T10:00:00Z" },
        { dealId: "DEAL-1003", supplierId: "SUP-002", indicatedQty: 8000, status: "approved", submittedAt: "2026-08-28T10:00:00Z" },
      ],
    };
  }

  function loadData() {
    var raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      var data = seedData();
      saveData(data);
      return data;
    }
    try {
      return JSON.parse(raw);
    } catch (e) {
      var fresh = seedData();
      saveData(fresh);
      return fresh;
    }
  }

  function saveData(data) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  }

  var DB = loadData();
  var session = null;
  try {
    session = JSON.parse(sessionStorage.getItem(SESSION_KEY) || "null");
  } catch (e) {
    session = null;
  }

  /* ---------------------------------------------------------------- */
  /* DOM helpers                                                       */
  /* ---------------------------------------------------------------- */

  function $(sel) {
    return document.querySelector(sel);
  }
  function $all(sel) {
    return Array.prototype.slice.call(document.querySelectorAll(sel));
  }

  /* ---------------------------------------------------------------- */
  /* Auth                                                              */
  /* ---------------------------------------------------------------- */

  function attemptLogin(username, password) {
    var user = DB.users.find(function (u) {
      return u.username === username && u.password === password;
    });
    if (!user) return null;
    return { username: user.username, role: user.role, name: user.name, supplierId: user.supplierId || null };
  }

  function login(username, password) {
    var user = attemptLogin(username, password);
    if (!user) return false;
    session = user;
    sessionStorage.setItem(SESSION_KEY, JSON.stringify(session));
    return true;
  }

  function logout() {
    session = null;
    sessionStorage.removeItem(SESSION_KEY);
    showLogin();
  }

  /* ---------------------------------------------------------------- */
  /* Screen switching                                                  */
  /* ---------------------------------------------------------------- */

  function showLogin() {
    $("#app-screen").hidden = true;
    $("#login-screen").hidden = false;
    $("#login-form").reset();
    $("#login-error").hidden = true;
  }

  function showApp() {
    $("#login-screen").hidden = true;
    $("#app-screen").hidden = false;
    $("#current-user-label").textContent = session.name + " (" + session.role + ")";

    var isAdmin = session.role === "admin";
    $(".admin-only").hidden = !isAdmin;

    // Suppliers don't need the raw admin tab; default everyone to grid/dashboard.
    if (isAdmin) {
      switchView("dashboard");
    } else {
      switchView("grid");
    }
  }

  function switchView(view) {
    $all(".view").forEach(function (el) {
      el.hidden = true;
    });
    $all(".nav-btn").forEach(function (el) {
      el.classList.toggle("active", el.dataset.view === view);
    });
    var target = $("#view-" + view);
    if (target) target.hidden = false;

    if (view === "grid") renderSupplierGrid();
    if (view === "dashboard") renderDashboard();
    if (view === "admin") renderAdmin();
  }

  /* ---------------------------------------------------------------- */
  /* Supplier grid view                                                */
  /* ---------------------------------------------------------------- */

  var supplierGridApi = null;

  function myDealsRows() {
    var supplierId = session.supplierId;
    return DB.deals.map(function (deal) {
      var existing = DB.indications.find(function (ind) {
        return ind.dealId === deal.id && ind.supplierId === supplierId;
      });
      return {
        dealId: deal.id,
        style: deal.style,
        description: deal.description,
        season: deal.season,
        color: deal.color,
        targetQty: deal.targetQty,
        deadline: deal.deadline,
        indicatedQty: existing ? existing.indicatedQty : null,
        status: existing ? existing.status : "not submitted",
      };
    });
  }

  function renderSupplierGrid() {
    var columnDefs = [
      { headerName: "Deal ID", field: "dealId", width: 120, pinned: "left" },
      { headerName: "Style", field: "style", width: 120 },
      { headerName: "Description", field: "description", flex: 1, minWidth: 200 },
      { headerName: "Season", field: "season", width: 100 },
      { headerName: "Color", field: "color", width: 130 },
      { headerName: "Target Qty", field: "targetQty", width: 120, type: "numericColumn" },
      { headerName: "Deadline", field: "deadline", width: 120 },
      {
        headerName: "My Indicated Qty",
        field: "indicatedQty",
        width: 150,
        editable: true,
        type: "numericColumn",
        cellStyle: { backgroundColor: "#fff7d6" },
        valueParser: function (params) {
          var n = Number(params.newValue);
          return isNaN(n) || n < 0 ? params.oldValue : n;
        },
      },
      {
        headerName: "Status",
        field: "status",
        width: 130,
        cellRenderer: function (params) {
          return statusBadge(params.value);
        },
      },
    ];

    var gridOptions = {
      columnDefs: columnDefs,
      rowData: myDealsRows(),
      defaultColDef: { resizable: true, sortable: true, filter: true },
      animateRows: true,
      onGridReady: function (params) {
        supplierGridApi = params.api;
      },
    };

    var el = $("#supplier-grid");
    el.innerHTML = "";
    if (window.agGrid && agGrid.Grid) {
      new agGrid.Grid(el, gridOptions);
      supplierGridApi = gridOptions.api;
    } else if (window.agGrid && agGrid.createGrid) {
      supplierGridApi = agGrid.createGrid(el, gridOptions);
    }
  }

  function statusBadge(status) {
    var span = document.createElement("span");
    span.textContent = status;
    span.style.textTransform = "capitalize";
    if (status === "approved") span.style.color = "#1a7a34";
    else if (status === "rejected") span.style.color = "#e50010";
    else if (status === "pending") span.style.color = "#a8710a";
    else span.style.color = "#888";
    return span;
  }

  function submitIndications() {
    if (!supplierGridApi) return;
    var rows = [];
    supplierGridApi.forEachNode(function (node) {
      rows.push(node.data);
    });

    var count = 0;
    rows.forEach(function (row) {
      if (row.indicatedQty === null || row.indicatedQty === undefined || row.indicatedQty === "") return;
      var existing = DB.indications.find(function (ind) {
        return ind.dealId === row.dealId && ind.supplierId === session.supplierId;
      });
      if (existing) {
        existing.indicatedQty = Number(row.indicatedQty);
        existing.status = "pending";
        existing.submittedAt = new Date().toISOString();
      } else {
        DB.indications.push({
          dealId: row.dealId,
          supplierId: session.supplierId,
          indicatedQty: Number(row.indicatedQty),
          status: "pending",
          submittedAt: new Date().toISOString(),
        });
      }
      count++;
    });

    saveData(DB);
    renderSupplierGrid();
    alert(count + " indication(s) submitted for review.");
  }

  function exportSupplierGrid() {
    var rows = myDealsRows();
    var ws = XLSX.utils.json_to_sheet(rows);
    var wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "My Indications");
    XLSX.writeFile(wb, "qty-indications-" + session.supplierId + ".xlsx");
  }

  /* ---------------------------------------------------------------- */
  /* Dashboard view                                                    */
  /* ---------------------------------------------------------------- */

  var charts = {};

  function destroyChart(key) {
    if (charts[key]) {
      charts[key].destroy();
      charts[key] = null;
    }
  }

  function totalIndicatedForDeal(dealId) {
    return DB.indications
      .filter(function (ind) {
        return ind.dealId === dealId;
      })
      .reduce(function (sum, ind) {
        return sum + Number(ind.indicatedQty || 0);
      }, 0);
  }

  function renderDashboard() {
    var deals = DB.deals;
    var totalTarget = deals.reduce(function (s, d) {
      return s + d.targetQty;
    }, 0);
    var totalIndicated = DB.indications.reduce(function (s, i) {
      return s + Number(i.indicatedQty || 0);
    }, 0);
    var pendingCount = DB.indications.filter(function (i) {
      return i.status === "pending";
    }).length;

    $("#stat-total-deals").textContent = deals.length;
    $("#stat-target-qty").textContent = totalTarget.toLocaleString();
    $("#stat-indicated-qty").textContent = totalIndicated.toLocaleString();
    $("#stat-pending").textContent = pendingCount;

    // Chart 1: target vs indicated per deal
    destroyChart("targetVsIndicated");
    var ctx1 = $("#chart-target-vs-indicated").getContext("2d");
    charts.targetVsIndicated = new Chart(ctx1, {
      type: "bar",
      data: {
        labels: deals.map(function (d) {
          return d.style;
        }),
        datasets: [
          {
            label: "Target Qty",
            data: deals.map(function (d) {
              return d.targetQty;
            }),
            backgroundColor: "#111111",
          },
          {
            label: "Indicated Qty",
            data: deals.map(function (d) {
              return totalIndicatedForDeal(d.id);
            }),
            backgroundColor: "#e50010",
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        scales: { y: { beginAtZero: true } },
      },
    });

    // Chart 2: status breakdown
    destroyChart("statusBreakdown");
    var statusCounts = { approved: 0, pending: 0, rejected: 0 };
    DB.indications.forEach(function (ind) {
      if (statusCounts[ind.status] !== undefined) statusCounts[ind.status]++;
    });
    var ctx2 = $("#chart-status-breakdown").getContext("2d");
    charts.statusBreakdown = new Chart(ctx2, {
      type: "doughnut",
      data: {
        labels: ["Approved", "Pending", "Rejected"],
        datasets: [
          {
            data: [statusCounts.approved, statusCounts.pending, statusCounts.rejected],
            backgroundColor: ["#1a7a34", "#f0a500", "#e50010"],
          },
        ],
      },
      options: { responsive: true, maintainAspectRatio: false },
    });

    // Chart 3: top suppliers by indicated qty
    destroyChart("topSuppliers");
    var bySupplier = {};
    DB.indications.forEach(function (ind) {
      bySupplier[ind.supplierId] = (bySupplier[ind.supplierId] || 0) + Number(ind.indicatedQty || 0);
    });
    var supplierLabels = Object.keys(bySupplier).map(function (id) {
      var s = DB.suppliers.find(function (s) {
        return s.id === id;
      });
      return s ? s.name : id;
    });
    var ctx3 = $("#chart-top-suppliers").getContext("2d");
    charts.topSuppliers = new Chart(ctx3, {
      type: "bar",
      data: {
        labels: supplierLabels,
        datasets: [
          {
            label: "Total Indicated Qty",
            data: Object.values(bySupplier),
            backgroundColor: "#e50010",
          },
        ],
      },
      options: {
        indexAxis: "y",
        responsive: true,
        maintainAspectRatio: false,
        scales: { x: { beginAtZero: true } },
      },
    });
  }

  /* ---------------------------------------------------------------- */
  /* Admin view                                                        */
  /* ---------------------------------------------------------------- */

  var adminDealsGridApi = null;
  var adminIndicationsGridApi = null;
  var adminSuppliersGridApi = null;

  function renderAdmin() {
    switchAdminTab("deals");
  }

  function switchAdminTab(tab) {
    $all(".admin-tab-btn").forEach(function (btn) {
      btn.classList.toggle("active", btn.dataset.adminTab === tab);
    });
    $all(".admin-tab-panel").forEach(function (panel) {
      panel.hidden = true;
    });
    $("#admin-tab-" + tab).hidden = false;

    if (tab === "deals") renderAdminDealsGrid();
    if (tab === "indications") renderAdminIndicationsGrid();
    if (tab === "suppliers") renderAdminSuppliersGrid();
  }

  function renderAdminDealsGrid() {
    var columnDefs = [
      { headerName: "Deal ID", field: "id", width: 120, editable: false, pinned: "left" },
      { headerName: "Style", field: "style", width: 130, editable: true },
      { headerName: "Description", field: "description", flex: 1, minWidth: 200, editable: true },
      { headerName: "Season", field: "season", width: 100, editable: true },
      { headerName: "Color", field: "color", width: 130, editable: true },
      { headerName: "Target Qty", field: "targetQty", width: 120, type: "numericColumn", editable: true },
      { headerName: "Deadline", field: "deadline", width: 120, editable: true },
      {
        headerName: "",
        field: "_actions",
        width: 90,
        cellRenderer: function (params) {
          var btn = document.createElement("button");
          btn.textContent = "Delete";
          btn.className = "btn btn-outline";
          btn.style.padding = "3px 8px";
          btn.style.fontSize = "11px";
          btn.addEventListener("click", function () {
            DB.deals = DB.deals.filter(function (d) {
              return d.id !== params.data.id;
            });
            DB.indications = DB.indications.filter(function (i) {
              return i.dealId !== params.data.id;
            });
            saveData(DB);
            renderAdminDealsGrid();
          });
          return btn;
        },
      },
    ];

    var gridOptions = {
      columnDefs: columnDefs,
      rowData: DB.deals.slice(),
      defaultColDef: { resizable: true, sortable: true, filter: true },
      animateRows: true,
      onCellValueChanged: function (params) {
        var deal = DB.deals.find(function (d) {
          return d.id === params.data.id;
        });
        if (deal) {
          deal[params.colDef.field] = params.newValue;
          saveData(DB);
        }
      },
      onGridReady: function (params) {
        adminDealsGridApi = params.api;
      },
    };

    mountGrid("#admin-deals-grid", gridOptions, function (api) {
      adminDealsGridApi = api;
    });
  }

  function renderAdminIndicationsGrid() {
    var rows = DB.indications.map(function (ind) {
      var deal = DB.deals.find(function (d) {
        return d.id === ind.dealId;
      });
      var supplier = DB.suppliers.find(function (s) {
        return s.id === ind.supplierId;
      });
      return {
        dealId: ind.dealId,
        dealStyle: deal ? deal.style : ind.dealId,
        supplierId: ind.supplierId,
        supplierName: supplier ? supplier.name : ind.supplierId,
        indicatedQty: ind.indicatedQty,
        targetQty: deal ? deal.targetQty : "",
        status: ind.status,
        submittedAt: ind.submittedAt,
      };
    });

    var columnDefs = [
      { headerName: "", field: "_sel", width: 40, checkboxSelection: true, headerCheckboxSelection: true, pinned: "left" },
      { headerName: "Deal", field: "dealStyle", width: 130 },
      { headerName: "Supplier", field: "supplierName", width: 180 },
      { headerName: "Indicated Qty", field: "indicatedQty", width: 130, type: "numericColumn", editable: true },
      { headerName: "Target Qty", field: "targetQty", width: 120, type: "numericColumn" },
      {
        headerName: "Status",
        field: "status",
        width: 120,
        cellRenderer: function (params) {
          return statusBadge(params.value);
        },
      },
      { headerName: "Submitted At", field: "submittedAt", width: 190 },
    ];

    var gridOptions = {
      columnDefs: columnDefs,
      rowData: rows,
      defaultColDef: { resizable: true, sortable: true, filter: true },
      rowSelection: "multiple",
      animateRows: true,
      onCellValueChanged: function (params) {
        var ind = DB.indications.find(function (i) {
          return i.dealId === params.data.dealId && i.supplierId === params.data.supplierId;
        });
        if (ind && params.colDef.field === "indicatedQty") {
          ind.indicatedQty = Number(params.newValue) || 0;
          saveData(DB);
        }
      },
      onGridReady: function (params) {
        adminIndicationsGridApi = params.api;
      },
    };

    mountGrid("#admin-indications-grid", gridOptions, function (api) {
      adminIndicationsGridApi = api;
    });
  }

  function setSelectedIndicationsStatus(status) {
    if (!adminIndicationsGridApi) return;
    var selected = adminIndicationsGridApi.getSelectedRows();
    selected.forEach(function (row) {
      var ind = DB.indications.find(function (i) {
        return i.dealId === row.dealId && i.supplierId === row.supplierId;
      });
      if (ind) ind.status = status;
    });
    saveData(DB);
    renderAdminIndicationsGrid();
  }

  function renderAdminSuppliersGrid() {
    var columnDefs = [
      { headerName: "Supplier ID", field: "id", width: 120, editable: false, pinned: "left" },
      { headerName: "Name", field: "name", flex: 1, minWidth: 180, editable: true },
      { headerName: "Country", field: "country", width: 140, editable: true },
      { headerName: "Contact", field: "contact", width: 220, editable: true },
      {
        headerName: "",
        field: "_actions",
        width: 90,
        cellRenderer: function (params) {
          var btn = document.createElement("button");
          btn.textContent = "Delete";
          btn.className = "btn btn-outline";
          btn.style.padding = "3px 8px";
          btn.style.fontSize = "11px";
          btn.addEventListener("click", function () {
            DB.suppliers = DB.suppliers.filter(function (s) {
              return s.id !== params.data.id;
            });
            saveData(DB);
            renderAdminSuppliersGrid();
          });
          return btn;
        },
      },
    ];

    var gridOptions = {
      columnDefs: columnDefs,
      rowData: DB.suppliers.slice(),
      defaultColDef: { resizable: true, sortable: true, filter: true },
      animateRows: true,
      onCellValueChanged: function (params) {
        var supplier = DB.suppliers.find(function (s) {
          return s.id === params.data.id;
        });
        if (supplier) {
          supplier[params.colDef.field] = params.newValue;
          saveData(DB);
        }
      },
      onGridReady: function (params) {
        adminSuppliersGridApi = params.api;
      },
    };

    mountGrid("#admin-suppliers-grid", gridOptions, function (api) {
      adminSuppliersGridApi = api;
    });
  }

  function mountGrid(selector, gridOptions, onReady) {
    var el = $(selector);
    el.innerHTML = "";
    if (window.agGrid && agGrid.createGrid) {
      var api = agGrid.createGrid(el, gridOptions);
      if (onReady) onReady(api);
    } else if (window.agGrid && agGrid.Grid) {
      new agGrid.Grid(el, gridOptions);
      if (onReady) onReady(gridOptions.api);
    }
  }

  function addDeal() {
    var id = "DEAL-" + Math.floor(1000 + Math.random() * 9000);
    DB.deals.push({
      id: id,
      style: "H&M-NEW",
      description: "New deal — edit description",
      season: "AW26",
      color: "TBD",
      targetQty: 0,
      deadline: "",
    });
    saveData(DB);
    renderAdminDealsGrid();
  }

  function addSupplier() {
    var id = "SUP-" + Math.floor(100 + Math.random() * 900);
    DB.suppliers.push({ id: id, name: "New Supplier", country: "", contact: "" });
    saveData(DB);
    renderAdminSuppliersGrid();
  }

  function exportDeals() {
    var ws = XLSX.utils.json_to_sheet(DB.deals);
    var wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Deals");
    XLSX.writeFile(wb, "hm-deals-export.xlsx");
  }

  function exportIndications() {
    var rows = DB.indications.map(function (ind) {
      var deal = DB.deals.find(function (d) {
        return d.id === ind.dealId;
      });
      var supplier = DB.suppliers.find(function (s) {
        return s.id === ind.supplierId;
      });
      return {
        dealId: ind.dealId,
        dealStyle: deal ? deal.style : "",
        supplierId: ind.supplierId,
        supplierName: supplier ? supplier.name : "",
        indicatedQty: ind.indicatedQty,
        status: ind.status,
        submittedAt: ind.submittedAt,
      };
    });
    var ws = XLSX.utils.json_to_sheet(rows);
    var wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Indications");
    XLSX.writeFile(wb, "hm-indications-export.xlsx");
  }

  function importDealsFromFile(file) {
    var reader = new FileReader();
    reader.onload = function (e) {
      var data = new Uint8Array(e.target.result);
      var wb = XLSX.read(data, { type: "array" });
      var sheet = wb.Sheets[wb.SheetNames[0]];
      var rows = XLSX.utils.sheet_to_json(sheet);
      var imported = 0;
      rows.forEach(function (row) {
        if (!row.id && !row.style) return;
        var id = row.id || "DEAL-" + Math.floor(1000 + Math.random() * 9000);
        var existing = DB.deals.find(function (d) {
          return d.id === id;
        });
        var record = {
          id: id,
          style: row.style || "",
          description: row.description || "",
          season: row.season || "",
          color: row.color || "",
          targetQty: Number(row.targetQty) || 0,
          deadline: row.deadline || "",
        };
        if (existing) {
          Object.assign(existing, record);
        } else {
          DB.deals.push(record);
        }
        imported++;
      });
      saveData(DB);
      renderAdminDealsGrid();
      alert(imported + " deal(s) imported.");
    };
    reader.readAsArrayBuffer(file);
  }

  /* ---------------------------------------------------------------- */
  /* Event wiring                                                      */
  /* ---------------------------------------------------------------- */

  document.addEventListener("DOMContentLoaded", function () {
    $("#login-form").addEventListener("submit", function (e) {
      e.preventDefault();
      var username = $("#login-username").value.trim();
      var password = $("#login-password").value;
      if (login(username, password)) {
        showApp();
      } else {
        $("#login-error").textContent = "Invalid username or password.";
        $("#login-error").hidden = false;
      }
    });

    $("#logout-btn").addEventListener("click", logout);

    $all(".nav-btn").forEach(function (btn) {
      btn.addEventListener("click", function () {
        switchView(btn.dataset.view);
      });
    });

    $all(".admin-tab-btn").forEach(function (btn) {
      btn.addEventListener("click", function () {
        switchAdminTab(btn.dataset.adminTab);
      });
    });

    $("#grid-submit-btn").addEventListener("click", submitIndications);
    $("#grid-export-btn").addEventListener("click", exportSupplierGrid);

    $("#deal-add-btn").addEventListener("click", addDeal);
    $("#deal-export-btn").addEventListener("click", exportDeals);
    $("#deal-import-btn").addEventListener("click", function () {
      $("#deal-import-input").click();
    });
    $("#deal-import-input").addEventListener("change", function (e) {
      if (e.target.files && e.target.files[0]) {
        importDealsFromFile(e.target.files[0]);
        e.target.value = "";
      }
    });

    $("#indication-approve-btn").addEventListener("click", function () {
      setSelectedIndicationsStatus("approved");
    });
    $("#indication-reject-btn").addEventListener("click", function () {
      setSelectedIndicationsStatus("rejected");
    });
    $("#indication-export-btn").addEventListener("click", exportIndications);

    $("#supplier-add-btn").addEventListener("click", addSupplier);

    if (session) {
      showApp();
    } else {
      showLogin();
    }
  });
})();

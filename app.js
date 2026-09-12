/* H&M Supplier Qty Indication Portal — application logic */
(function () {
  "use strict";

  var STORAGE_KEY = "hm_sqip_data_v2";
  var SESSION_KEY = "hm_sqip_session_v1";

  /* ---------------------------------------------------------------- */
  /* Yarn deal field metadata — single source of truth for column      */
  /* headers, grid editability, import/export mapping and enums.       */
  /* ---------------------------------------------------------------- */

  var LC_STATUS_OPTIONS = ["TBA", "In Process", "Opened", "Not Required"];
  var ALLOCATION_STATUS_OPTIONS = ["Draft", "Submitted", "Approved", "Rejected"];
  var DEAL_TYPE_OPTIONS = ["Forward Cover", "Committed", "Indicative", "Spot Buy"];
  var ASSORTMENT_OPTIONS = ["Knits", "Wovens", "Denim", "Accessories"];
  var DEPT_OPTIONS = ["Menswear", "Womenswear", "Kids", "Divided", "H&M Home"];
  var INCOTERM_OPTIONS = ["FOB", "CIF", "CFR", "EXW"];
  var SHIPMENT_MODE_OPTIONS = ["Sea", "Air", "Rail", "Road"];
  var SUSTAINABILITY_OPTIONS = ["None", "GRS", "OCS", "RCS"];

  // supplierEditable: fields a logged-in yarn supplier may fill in on their own deals.
  // computed: fields derived from other fields — never directly editable, always recalculated.
  var DEAL_FIELDS = [
    { field: "id", header: "Deal ID", width: 120, type: "text", pinned: "left" },
    { field: "yarnSupplier", header: "Yarn Supplier", width: 170, type: "text" },
    { field: "garmentSupplier", header: "Garment Supplier", width: 170, type: "text" },
    { field: "poStyleRef", header: "PO / Style Ref", width: 130, type: "text", supplierEditable: true },
    { field: "assortment", header: "Assortment", width: 110, type: "select", options: ASSORTMENT_OPTIONS },
    { field: "garmentGroup", header: "Garment Group", width: 130, type: "text" },
    { field: "dealType", header: "Deal Type", width: 120, type: "select", options: DEAL_TYPE_OPTIONS },
    { field: "season", header: "Season", width: 90, type: "text" },
    { field: "block", header: "Block", width: 90, type: "text" },
    { field: "dept", header: "Dept", width: 110, type: "select", options: DEPT_OPTIONS },
    { field: "garmentOPD", header: "Garment OPD (Estimated)", width: 160, type: "date" },
    { field: "yarnOrderDate", header: "Yarn Order Date", width: 140, type: "date" },
    { field: "yarnETA", header: "Yarn ETA to T1/T2", width: 150, type: "date" },
    { field: "yarnInWarehouse", header: "Yarn in T1/T2 Warehouse", width: 170, type: "number", supplierEditable: true },
    { field: "cop", header: "COP", width: 110, type: "text" },
    { field: "t1t2Name", header: "T1/T2 Name", width: 180, type: "text" },
    { field: "count", header: "Count", width: 100, type: "text" },
    { field: "yarnComposition", header: "Yarn Composition", width: 180, type: "text" },
    { field: "recoverPct", header: "Recover %", width: 100, type: "number" },
    { field: "sustainabilityCert", header: "Sustainability Cert", width: 140, type: "select", options: SUSTAINABILITY_OPTIONS },
    { field: "yarnPrice", header: "Yarn Price", width: 110, type: "number", supplierEditable: true },
    { field: "currency", header: "Currency", width: 90, type: "text" },
    { field: "totalAllocatedYarnTon", header: "Total Allocated Yarn TON", width: 180, type: "number", supplierEditable: true },
    { field: "totalRecoverFiberQty", header: "Total Recover Fiber Qty", width: 170, type: "number" },
    { field: "lcOpeningStatus", header: "LC Opening Status", width: 140, type: "select", options: LC_STATUS_OPTIONS },
    { field: "lcNumber", header: "LC Number", width: 140, type: "text" },
    { field: "lcOpenedYarnTons", header: "LC Opened Yarn Tons", width: 160, type: "number" },
    {
      field: "balanceLcYarnTons",
      header: "Balance LC Yarn Tons",
      width: 160,
      type: "number",
      computed: function (row) {
        return round2(Number(row.totalAllocatedYarnTon || 0) - Number(row.lcOpenedYarnTons || 0));
      },
    },
    { field: "lcOpenRecoverTon", header: "LC Open Recover Ton", width: 160, type: "number" },
    {
      field: "balanceLcOpenRecoverTon",
      header: "Balance LC Open Recover TON",
      width: 190,
      type: "number",
      computed: function (row) {
        return round2(Number(row.totalRecoverFiberQty || 0) - Number(row.lcOpenRecoverTon || 0));
      },
    },
    { field: "dispatchedQty", header: "Dispatched Qty", width: 130, type: "number", supplierEditable: true },
    {
      field: "balanceToDispatch",
      header: "Balance to Dispatch",
      width: 150,
      type: "number",
      computed: function (row) {
        return round2(Number(row.totalAllocatedYarnTon || 0) - Number(row.dispatchedQty || 0));
      },
    },
    { field: "incoterm", header: "Incoterm", width: 100, type: "select", options: INCOTERM_OPTIONS },
    { field: "shipmentMode", header: "Shipment Mode", width: 130, type: "select", options: SHIPMENT_MODE_OPTIONS },
    { field: "allocationStatus", header: "Allocation Status", width: 140, type: "select", options: ALLOCATION_STATUS_OPTIONS },
    { field: "freeText", header: "Free Text", width: 200, type: "text", supplierEditable: true },
    { field: "lcNumberRemarkSpacer", header: "", width: 0, type: "hidden", skip: true },
    { field: "remark", header: "Remark", width: 200, type: "text" },
    { field: "updatedAt", header: "Last Updated", width: 170, type: "text" },
  ].filter(function (f) {
    return !f.skip;
  });

  function round2(n) {
    return Math.round((n + Number.EPSILON) * 100) / 100;
  }

  function fieldMeta(name) {
    return DEAL_FIELDS.find(function (f) {
      return f.field === name;
    });
  }

  /* ---------------------------------------------------------------- */
  /* Seed data / persistence                                          */
  /* ---------------------------------------------------------------- */

  function seedData() {
    return {
      users: [
        { username: "admin", password: "admin123", role: "admin", name: "H&M Admin" },
        { username: "supplier1", password: "supplier123", role: "supplier", name: "Meridian Spinning Mills", supplierName: "Meridian Spinning Mills" },
        { username: "supplier2", password: "supplier123", role: "supplier", name: "BlueThread Yarns Ltd.", supplierName: "BlueThread Yarns Ltd." },
      ],
      suppliers: [
        { id: "YSUP-001", name: "Meridian Spinning Mills", type: "T2", country: "Bangladesh", contact: "contact@meridianspin.example" },
        { id: "YSUP-002", name: "BlueThread Yarns Ltd.", type: "T2", country: "India", contact: "sales@bluethread.example" },
        { id: "YSUP-003", name: "EcoFiber Spinners", type: "T2", country: "Vietnam", contact: "info@ecofiberspin.example" },
      ],
      deals: [
        {
          id: "YD-1001", yarnSupplier: "Meridian Spinning Mills", garmentSupplier: "Bengal Textiles Ltd.",
          poStyleRef: "H&M-8834", assortment: "Knits", garmentGroup: "Jersey", dealType: "Committed",
          season: "AW26", block: "Block-1", dept: "Menswear", garmentOPD: "2026-09-10",
          yarnOrderDate: "2026-07-01", yarnETA: "2026-08-15", yarnInWarehouse: 180,
          cop: "Bangladesh", t1t2Name: "Bengal Textiles Ltd. (T1)", count: "Ne 30/1",
          yarnComposition: "100% Cotton", recoverPct: 0, sustainabilityCert: "None",
          yarnPrice: 3.85, currency: "USD", totalAllocatedYarnTon: 220, totalRecoverFiberQty: 0,
          lcOpeningStatus: "Opened", lcNumber: "LC-2026-0451", lcOpenedYarnTons: 220,
          lcOpenRecoverTon: 0, dispatchedQty: 120, incoterm: "FOB", shipmentMode: "Sea",
          allocationStatus: "Approved", freeText: "", remark: "First tranche dispatched on schedule.",
          updatedAt: "2026-09-01T10:00:00Z",
        },
        {
          id: "YD-1002", yarnSupplier: "BlueThread Yarns Ltd.", garmentSupplier: "Dhaka Garments Co.",
          poStyleRef: "H&M-9021", assortment: "Knits", garmentGroup: "Sweater", dealType: "Forward Cover",
          season: "AW26", block: "Block-2", dept: "Womenswear", garmentOPD: "2026-09-25",
          yarnOrderDate: "2026-07-20", yarnETA: "2026-09-05", yarnInWarehouse: 60,
          cop: "India", t1t2Name: "Dhaka Garments Co. (T1)", count: "Ne 24/1",
          yarnComposition: "70% Cotton / 30% Recycled Poly", recoverPct: 30, sustainabilityCert: "GRS",
          yarnPrice: 4.20, currency: "USD", totalAllocatedYarnTon: 340, totalRecoverFiberQty: 102,
          lcOpeningStatus: "In Process", lcNumber: "", lcOpenedYarnTons: 0,
          lcOpenRecoverTon: 0, dispatchedQty: 0, incoterm: "CIF", shipmentMode: "Sea",
          allocationStatus: "Submitted", freeText: "Awaiting price confirmation.", remark: "",
          updatedAt: "2026-09-03T10:00:00Z",
        },
        {
          id: "YD-1003", yarnSupplier: "Meridian Spinning Mills", garmentSupplier: "Dhaka Garments Co.",
          poStyleRef: "H&M-7745", assortment: "Knits", garmentGroup: "Fleece", dealType: "Indicative",
          season: "AW26", block: "Block-1", dept: "Kids", garmentOPD: "2026-10-05",
          yarnOrderDate: "", yarnETA: "", yarnInWarehouse: 0,
          cop: "Bangladesh", t1t2Name: "Dhaka Garments Co. (T1)", count: "Ne 20/1",
          yarnComposition: "80% Cotton / 20% Polyester", recoverPct: 0, sustainabilityCert: "None",
          yarnPrice: 3.60, currency: "USD", totalAllocatedYarnTon: 150, totalRecoverFiberQty: 0,
          lcOpeningStatus: "TBA", lcNumber: "", lcOpenedYarnTons: 0,
          lcOpenRecoverTon: 0, dispatchedQty: 0, incoterm: "FOB", shipmentMode: "Sea",
          allocationStatus: "Draft", freeText: "", remark: "Pending garment OPD confirmation.",
          updatedAt: "2026-08-28T10:00:00Z",
        },
        {
          id: "YD-1004", yarnSupplier: "EcoFiber Spinners", garmentSupplier: "Guangzhou Apparel Group",
          poStyleRef: "H&M-6612", assortment: "Wovens", garmentGroup: "Woven Bottoms", dealType: "Committed",
          season: "SS27", block: "Block-3", dept: "Menswear", garmentOPD: "2026-12-01",
          yarnOrderDate: "2026-09-10", yarnETA: "2026-10-20", yarnInWarehouse: 0,
          cop: "Vietnam", t1t2Name: "Guangzhou Apparel Group (T1)", count: "Ne 40/2",
          yarnComposition: "97% Cotton / 3% Elastane", recoverPct: 0, sustainabilityCert: "OCS",
          yarnPrice: 4.55, currency: "USD", totalAllocatedYarnTon: 280, totalRecoverFiberQty: 0,
          lcOpeningStatus: "Opened", lcNumber: "LC-2026-0512", lcOpenedYarnTons: 180,
          lcOpenRecoverTon: 0, dispatchedQty: 0, incoterm: "CFR", shipmentMode: "Sea",
          allocationStatus: "Approved", freeText: "", remark: "Partial LC opened; balance planned next cycle.",
          updatedAt: "2026-09-05T10:00:00Z",
        },
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
    return { username: user.username, role: user.role, name: user.name, supplierName: user.supplierName || null };
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
  /* Shared column-def builder                                        */
  /* ---------------------------------------------------------------- */

  function buildColumnDefs(opts) {
    // opts.editableFor: "admin" | "supplier" | null (read-only grid)
    var editableFor = opts.editableFor;
    return DEAL_FIELDS.map(function (meta) {
      var col = {
        headerName: meta.header,
        field: meta.field,
        width: meta.width,
      };
      if (meta.pinned) col.pinned = meta.pinned;
      if (meta.type === "number") col.type = "numericColumn";

      if (meta.computed) {
        col.valueGetter = function (params) {
          return meta.computed(params.data);
        };
        col.editable = false;
      } else if (editableFor === "admin" && meta.field !== "id") {
        col.editable = true;
      } else if (editableFor === "supplier" && meta.supplierEditable) {
        col.editable = true;
        col.cellStyle = { backgroundColor: "#fff7d6" };
      } else {
        col.editable = false;
      }

      if (meta.type === "select" && col.editable) {
        col.cellEditor = "agSelectCellEditor";
        col.cellEditorParams = { values: meta.options };
      }

      if (meta.field === "allocationStatus" || meta.field === "lcOpeningStatus") {
        col.cellRenderer = function (params) {
          return statusBadge(params.value);
        };
      }

      return col;
    });
  }

  /* ---------------------------------------------------------------- */
  /* Supplier grid view                                                */
  /* ---------------------------------------------------------------- */

  var supplierGridApi = null;

  function myDealsRows() {
    return DB.deals.filter(function (deal) {
      return deal.yarnSupplier === session.supplierName;
    });
  }

  function renderSupplierGrid() {
    var columnDefs = buildColumnDefs({ editableFor: "supplier" });

    var gridOptions = {
      columnDefs: columnDefs,
      rowData: myDealsRows(),
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
        supplierGridApi = params.api;
      },
    };

    mountGrid("#supplier-grid", gridOptions, function (api) {
      supplierGridApi = api;
    });
  }

  function statusBadge(status) {
    var span = document.createElement("span");
    span.textContent = status;
    var colors = {
      approved: "#1a7a34",
      opened: "#1a7a34",
      submitted: "#a8710a",
      "in process": "#a8710a",
      rejected: "#e50010",
      draft: "#888",
      tba: "#888",
      "not required": "#888",
    };
    span.style.color = colors[String(status).toLowerCase()] || "#333";
    return span;
  }

  function submitIndications() {
    if (!supplierGridApi) return;
    var rows = [];
    supplierGridApi.forEachNode(function (node) {
      rows.push(node.data);
    });

    var now = new Date().toISOString();
    var count = 0;
    rows.forEach(function (row) {
      var deal = DB.deals.find(function (d) {
        return d.id === row.id;
      });
      if (!deal) return;
      if (deal.allocationStatus === "Draft" || deal.allocationStatus === "Rejected") {
        deal.allocationStatus = "Submitted";
      }
      deal.updatedAt = now;
      count++;
    });

    saveData(DB);
    renderSupplierGrid();
    alert(count + " deal row(s) updated and submitted for review.");
  }

  function exportSupplierGrid() {
    var rows = myDealsRows().map(rowToExportRecord);
    var ws = XLSX.utils.json_to_sheet(rows);
    var wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "My Yarn Deals");
    XLSX.writeFile(wb, "yarn-deal-allocations-" + (session.supplierName || "supplier").replace(/\s+/g, "-") + ".xlsx");
  }

  function rowToExportRecord(row) {
    var record = {};
    DEAL_FIELDS.forEach(function (meta) {
      record[meta.header] = meta.computed ? meta.computed(row) : row[meta.field];
    });
    return record;
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

  function balanceLcYarnTons(deal) {
    return round2(Number(deal.totalAllocatedYarnTon || 0) - Number(deal.lcOpenedYarnTons || 0));
  }

  function renderDashboard() {
    var deals = DB.deals;
    var totalAllocated = deals.reduce(function (s, d) {
      return s + Number(d.totalAllocatedYarnTon || 0);
    }, 0);
    var totalDispatched = deals.reduce(function (s, d) {
      return s + Number(d.dispatchedQty || 0);
    }, 0);
    var lcPending = deals.filter(function (d) {
      return d.lcOpeningStatus === "TBA" || d.lcOpeningStatus === "In Process";
    }).length;

    $("#stat-total-deals").textContent = deals.length;
    $("#stat-target-qty").textContent = round2(totalAllocated).toLocaleString();
    $("#stat-indicated-qty").textContent = round2(totalDispatched).toLocaleString();
    $("#stat-pending").textContent = lcPending;

    // Chart 1: allocated vs balance LC yarn tons per deal
    destroyChart("targetVsIndicated");
    var ctx1 = $("#chart-target-vs-indicated").getContext("2d");
    charts.targetVsIndicated = new Chart(ctx1, {
      type: "bar",
      data: {
        labels: deals.map(function (d) {
          return d.poStyleRef || d.id;
        }),
        datasets: [
          {
            label: "Total Allocated Yarn TON",
            data: deals.map(function (d) {
              return Number(d.totalAllocatedYarnTon || 0);
            }),
            backgroundColor: "#111111",
          },
          {
            label: "Balance LC Yarn Tons",
            data: deals.map(balanceLcYarnTons),
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

    // Chart 2: allocation status breakdown
    destroyChart("statusBreakdown");
    var statusCounts = {};
    ALLOCATION_STATUS_OPTIONS.forEach(function (s) {
      statusCounts[s] = 0;
    });
    deals.forEach(function (d) {
      if (statusCounts[d.allocationStatus] !== undefined) statusCounts[d.allocationStatus]++;
    });
    var ctx2 = $("#chart-status-breakdown").getContext("2d");
    charts.statusBreakdown = new Chart(ctx2, {
      type: "doughnut",
      data: {
        labels: ALLOCATION_STATUS_OPTIONS,
        datasets: [
          {
            data: ALLOCATION_STATUS_OPTIONS.map(function (s) {
              return statusCounts[s];
            }),
            backgroundColor: ["#9a9a9a", "#f0a500", "#1a7a34", "#e50010"],
          },
        ],
      },
      options: { responsive: true, maintainAspectRatio: false },
    });

    // Chart 3: top yarn suppliers by allocated tons
    destroyChart("topSuppliers");
    var bySupplier = {};
    deals.forEach(function (d) {
      bySupplier[d.yarnSupplier] = (bySupplier[d.yarnSupplier] || 0) + Number(d.totalAllocatedYarnTon || 0);
    });
    var ctx3 = $("#chart-top-suppliers").getContext("2d");
    charts.topSuppliers = new Chart(ctx3, {
      type: "bar",
      data: {
        labels: Object.keys(bySupplier),
        datasets: [
          {
            label: "Total Allocated Yarn TON",
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
    if (tab === "suppliers") renderAdminSuppliersGrid();
  }

  function renderAdminDealsGrid() {
    var columnDefs = buildColumnDefs({ editableFor: "admin" });
    columnDefs.push({
      headerName: "",
      field: "_sel",
      width: 40,
      checkboxSelection: true,
      headerCheckboxSelection: true,
      pinned: "left",
      editable: false,
    });
    columnDefs.push({
      headerName: "",
      field: "_actions",
      width: 90,
      editable: false,
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
          saveData(DB);
          renderAdminDealsGrid();
        });
        return btn;
      },
    });

    var gridOptions = {
      columnDefs: columnDefs,
      rowData: DB.deals.slice(),
      defaultColDef: { resizable: true, sortable: true, filter: true },
      rowSelection: "multiple",
      animateRows: true,
      onCellValueChanged: function (params) {
        var deal = DB.deals.find(function (d) {
          return d.id === params.data.id;
        });
        if (deal) {
          deal[params.colDef.field] = params.newValue;
          deal.updatedAt = new Date().toISOString();
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

  function setSelectedDealsStatus(status) {
    if (!adminDealsGridApi) return;
    var selected = adminDealsGridApi.getSelectedRows();
    var now = new Date().toISOString();
    selected.forEach(function (row) {
      var deal = DB.deals.find(function (d) {
        return d.id === row.id;
      });
      if (deal) {
        deal.allocationStatus = status;
        deal.updatedAt = now;
      }
    });
    saveData(DB);
    renderAdminDealsGrid();
  }

  function renderAdminSuppliersGrid() {
    var columnDefs = [
      { headerName: "Supplier ID", field: "id", width: 120, editable: false, pinned: "left" },
      { headerName: "Name", field: "name", flex: 1, minWidth: 180, editable: true },
      { headerName: "Type", field: "type", width: 90, editable: true, cellEditor: "agSelectCellEditor", cellEditorParams: { values: ["T1", "T2"] } },
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
    var id = "YD-" + Math.floor(1000 + Math.random() * 9000);
    var blank = { id: id, allocationStatus: "Draft", lcOpeningStatus: "TBA", updatedAt: new Date().toISOString() };
    DEAL_FIELDS.forEach(function (meta) {
      if (!(meta.field in blank) && !meta.computed) {
        blank[meta.field] = meta.type === "number" ? 0 : "";
      }
    });
    DB.deals.push(blank);
    saveData(DB);
    renderAdminDealsGrid();
  }

  function addSupplier() {
    var id = "YSUP-" + Math.floor(100 + Math.random() * 900);
    DB.suppliers.push({ id: id, name: "New Yarn Supplier", type: "T2", country: "", contact: "" });
    saveData(DB);
    renderAdminSuppliersGrid();
  }

  function exportDeals() {
    var rows = DB.deals.map(rowToExportRecord);
    var ws = XLSX.utils.json_to_sheet(rows);
    var wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Yarn Deals");
    XLSX.writeFile(wb, "hm-yarn-deals-export.xlsx");
  }

  // Maps an imported spreadsheet's header text back to our field keys —
  // matched case/whitespace-insensitively so a pasted-in H&M tracker sheet
  // (using the exact column names) lines up without manual remapping.
  function buildHeaderLookup() {
    var lookup = {};
    DEAL_FIELDS.forEach(function (meta) {
      lookup[normalizeHeader(meta.header)] = meta.field;
    });
    return lookup;
  }

  function normalizeHeader(text) {
    return String(text || "").trim().toLowerCase().replace(/\s+/g, " ");
  }

  function importDealsFromFile(file) {
    var reader = new FileReader();
    var headerLookup = buildHeaderLookup();
    reader.onload = function (e) {
      var data = new Uint8Array(e.target.result);
      var wb = XLSX.read(data, { type: "array" });
      var sheet = wb.Sheets[wb.SheetNames[0]];
      var rows = XLSX.utils.sheet_to_json(sheet);
      var imported = 0;
      rows.forEach(function (row) {
        var record = {};
        Object.keys(row).forEach(function (header) {
          var field = headerLookup[normalizeHeader(header)];
          if (field && !fieldMeta(field).computed) {
            record[field] = row[header];
          }
        });
        if (!record.id && !record.yarnSupplier) return;

        var id = record.id || "YD-" + Math.floor(1000 + Math.random() * 9000);
        record.id = id;
        var existing = DB.deals.find(function (d) {
          return d.id === id;
        });
        if (existing) {
          Object.assign(existing, record);
        } else {
          if (!record.allocationStatus) record.allocationStatus = "Draft";
          if (!record.lcOpeningStatus) record.lcOpeningStatus = "TBA";
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
    $("#deal-approve-btn").addEventListener("click", function () {
      setSelectedDealsStatus("Approved");
    });
    $("#deal-reject-btn").addEventListener("click", function () {
      setSelectedDealsStatus("Rejected");
    });
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

    $("#supplier-add-btn").addEventListener("click", addSupplier);

    if (session) {
      showApp();
    } else {
      showLogin();
    }
  });
})();

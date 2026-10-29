
const API_URL = "http://localhost:3000";

async function loadDashboard() {
const message = document.getElementById("message");
const table = document.getElementById("applications-table");

try {
    message.textContent = "Loading applications...";

    const [statsResponse, applicationsResponse] = await Promise.all([
        fetch(`${API_URL}/api/admin/stats`),
        fetch(`${API_URL}/api/admin/applications`)
    ]);

    if (!statsResponse.ok || !applicationsResponse.ok) {
        throw new Error("Unable to load dashboard data.");
    }

    const stats = await statsResponse.json();
    const applications = await applicationsResponse.json();

    document.getElementById("total-count").textContent =
        stats.totalApplications ?? 0;

    document.getElementById("frontend-count").textContent =
        stats.frontendApplications ?? 0;

    document.getElementById("data-count").textContent =
        stats.dataAnalyticsApplications ?? 0;

    document.getElementById("uiux-count").textContent =
        stats.uiuxApplications ?? 0;

    table.replaceChildren();

    if (applications.length === 0) {
        message.textContent = "No applications found.";
        return;
    }

    applications.forEach(app => {
    const row = document.createElement("tr");

    const name = document.createElement("td");
    name.textContent = app.studentName || "N/A";

    const email = document.createElement("td");
    email.textContent = app.studentEmail || "N/A";

    const phone = document.createElement("td");
    phone.textContent = app.studentPhone || "N/A";

    const internship = document.createElement("td");
    internship.textContent = app.internshipTitle || "N/A";

    row.append(name, email, phone, internship);
    table.appendChild(row);
});
    

    message.textContent = `Total applications: ${applications.length}`;

} catch (error) {
    message.textContent ="";
    console.error(error);
}

}

loadDashboard();
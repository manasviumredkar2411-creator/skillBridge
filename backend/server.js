const express = require("express");
const mysql = require("mysql2/promise");
const cors = require("cors");
require("dotenv").config();
const fs = require("fs");
const path = require("path");

const app = express();

app.use(cors());
app.use(express.json());

const dbConfig = {
    host: process.env.DB_HOST,
    port: Number(process.env.DB_PORT),
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    ssl:{
        ca:
        fs.readFileSync(path.join(__dirname,
            "ca.pem"), "utf8"),
            rejectUnauthorized:true
        
    }
    
};

app.get("/", (req, res) => {
    res.send("SkillBridge backend is running!");
});
app.get("/api/admin/stats", async (req, res) => {
    let connection;

    try {
        connection = await mysql.createConnection(dbConfig);

        const [rows] = await connection.execute(`
            SELECT
                COUNT(*) AS totalApplications,
                COALESCE(SUM(CASE
                    WHEN internship_title LIKE '%Frontend%'
                    THEN 1 ELSE 0
                END), 0) AS frontendApplications,
                COALESCE(SUM(CASE
                    WHEN internship_title LIKE '%Data Analyst%'
                      OR internship_title LIKE '%Data Analytics%'
                    THEN 1 ELSE 0
                END),0) AS dataAnalyticsApplications,
                COALESCE(SUM(CASE
                    WHEN internship_title LIKE '%UI/UX%'
                      OR internship_title LIKE '%UI UX%'
                      OR internship_title LIKE '%UX/UI%'
                    THEN 1 ELSE 0
                END),0) AS uiuxApplications
            FROM applications
        `);

        res.json(rows[0]);

    } catch (error) {
        console.error("Admin stats error:", error.message);
        res.status(500).json({
            error: "Could not fetch application statistics"
        });

    } finally {
        if (connection) {
            await connection.end();
        }
    }
});
app.post("/api/applications", async (req, res) => {
const { name, email, phone, skills, internship_title } = req.body;

if (!name || !email || !internship_title) {
    return res.status(400).json({
        error: "Name, email, and internship title are required."
    });
}

let connection;

try {
    connection = await mysql.createConnection(dbConfig);
    await connection.beginTransaction();

    await connection.execute(
        `INSERT INTO students (name, email, phone, skills)
         VALUES (?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE
            name = VALUES(name),
            phone = VALUES(phone),
            skills = VALUES(skills)`,
        [name, email, phone || null, skills || null]
    );

    const [students] = await connection.execute(
        "SELECT id FROM students WHERE email = ?",
        [email]
    );

    const studentId = students[0].id;

    const [existing] = await connection.execute(
        `SELECT id FROM applications
         WHERE student_id = ? AND internship_title = ?
         LIMIT 1`,
        [studentId, internship_title]
    );

    if (existing.length > 0) {
        await connection.rollback();
        return res.status(409).json({
            error: "You have already applied for this internship."
        });
    }

    await connection.execute(
        `INSERT INTO applications (student_id, internship_title)
         VALUES (?, ?)`,
        [studentId, internship_title]
    );

    await connection.commit();

    res.status(201).json({
        message: "Application submitted successfully."
    });

} catch (error) {
    if (connection) {
        await connection.rollback();
    }

    console.error("Application save error:", error.message);

    res.status(500).json({
        error: "Could not save application."
    });

} finally {
    if (connection) {
        await connection.end();
    }
}

});

app.get("/api/admin/applications", async (req, res) => {
let connection;

try {
    connection = await mysql.createConnection(dbConfig);

    const [applications] = await connection.execute(`
    SELECT
    students.name AS studentName,
    students.email AS studentEmail,
    students.phone AS studentPhone,
    applications.internship_title AS internshipTitle,
    applications.applied_at AS appliedAt
    FROM applications
    INNER JOIN students
        ON applications.student_id = students.id
    ORDER BY applications.applied_at DESC 
`);

    res.json(applications);

} catch (error) {
    console.error("Applications list error:", error.message);
    console.error(error);

    res.status(500).json({
        error: error.message
    });

} finally {
    if (connection) {
        await connection.end();
    }
}

});

async function startServer() {
    try {
        const connection = await mysql.createConnection(dbConfig);

        await connection.execute(`
            CREATE TABLE IF NOT EXISTS students (
                id INT AUTO_INCREMENT PRIMARY KEY,
                name VARCHAR(255) NOT NULL,
                email VARCHAR(255) NOT NULL UNIQUE,
                phone VARCHAR(50),
                skills TEXT
            )
        `);

        await connection.execute(`
            CREATE TABLE IF NOT EXISTS applications (
                id INT AUTO_INCREMENT PRIMARY KEY,
                student_id INT NOT NULL,
                internship_title VARCHAR(255) NOT NULL,
                applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);

        console.log("MySQL database connected successfully!");
        await connection.end();

        const PORT = process.env.PORT || 3000;
        app.listen(PORT, () => {
            console.log(`SkillBridge backend running on port ${PORT}`);
        });

    } catch (error) {
        console.error("Database connection failed:", error.message);
    }
}

startServer();
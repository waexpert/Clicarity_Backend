const pool = require("../database/databaseConnection");

exports.handleSearch = async (req, res) => {

    const { schemaName, tableName, query } = req.query

    try {
        const result = await pool.query(
                    `
        SELECT us_id
        FROM ${schemaName}.${tableName}
        WHERE us_id ILIKE $1
        ORDER BY us_id
        LIMIT 10
        `,
            [`${query}%`]
        );

        res.status(200).json({
            success: true,
            data :result
        })

    } catch (error) {      
        res.status(500).json({
            success: false,
            error: "Failed to Search",
            details: error.message
        });
    }


}
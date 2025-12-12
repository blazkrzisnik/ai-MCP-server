import mysql from 'mysql2/promise';
import express from 'express';
import cors from 'cors';

// Konfiguracija za SQL bazo
const dbConfig = {
  host: 'localhost',
  user: 'root',
  password: 'root123',  // ⬅️ TVOJE GESLO
  database: 'employees'
};

let connection;

async function initDatabase() {
  connection = await mysql.createConnection(dbConfig);
  console.log('✓ MCP Server: Povezava z bazo uspešna');
}

const TOOLS = [
  {
    name: "mysql:listEmployees",
    description: "Pridobi seznam vseh zaposlenih s plačami",
    inputSchema: {
      type: "object",
      properties: {},
    }
  },
  {
    name: "mysql:salaryFor",
    description: "Pridobi plačo za zaposlenega po imenu",
    inputSchema: {
      type: "object",
      properties: {
        name: {
          type: "string",
          description: "Polno ime zaposlenega (npr. 'Janez Novak')"
        }
      },
      required: ["name"]
    }
  },
  {
    name: "mysql:executeSQL",
    description: "Izvedi poljubno SQL poizvedbo",
    inputSchema: {
      type: "object",
      properties: {
        query: {
          type: "string",
          description: "SQL poizvedba"
        }
      },
      required: ["query"]
    }
  }
];

async function handleToolCall(name, args) {
  switch (name) {
    case "mysql:listEmployees": {
      console.log('🔍 Izvajam SELECT za listEmployees...');
      
      // Pridobi vse zaposlene
      const [employees] = await connection.execute(`
        SELECT emp_no, first_name, last_name
        FROM employees
        LIMIT 50
      `);
      
      console.log(`✓ Pridobljeno ${employees.length} zaposlenih`);
      
      // Za vsakega zaposlenega pridobi zadnjo plačo
      const results = [];
      for (const emp of employees) {
        const [salaryRows] = await connection.execute(`
          SELECT salary, bonus, currency 
          FROM salaries 
          WHERE emp_no = ? 
          ORDER BY to_date DESC 
          LIMIT 1
        `, [emp.emp_no]);
        
        results.push({
          emp_no: emp.emp_no,
          first_name: emp.first_name,
          last_name: emp.last_name,
          full_name: `${emp.first_name} ${emp.last_name}`,
          salary: salaryRows[0]?.salary || 0,
          bonus: salaryRows[0]?.bonus || 0,
          currency: salaryRows[0]?.currency || 'EUR'
        });
      }
      
      console.log('✓ Prvi rezultat:', results[0]);
      
      return {
        content: [{
          type: "text",
          text: JSON.stringify(results, null, 2)
        }]
      };
    }

    case "mysql:salaryFor": {
      console.log('🔍 Iščem plačo za:', args.name);
      
      const nameParts = args.name.trim().split(/\s+/);
      const firstName = nameParts[0];
      const lastName = nameParts.slice(1).join(' ');
      
      console.log(`  Ime: ${firstName}, Priimek: ${lastName}`);
      
      // Poišči zaposlenega
      const [employees] = await connection.execute(`
        SELECT emp_no, first_name, last_name
        FROM employees
        WHERE first_name LIKE ? AND last_name LIKE ?
      `, [`%${firstName}%`, `%${lastName}%`]);
      
      if (employees.length === 0) {
        console.log('✗ Zaposleni ni najden');
        return {
          content: [{
            type: "text",
            text: `Zaposleni "${args.name}" ni bil najden v bazi.`
          }]
        };
      }
      
      const emp = employees[0];
      
      // Pridobi plačo
      const [salaryRows] = await connection.execute(`
        SELECT salary, bonus, currency, from_date, to_date
        FROM salaries
        WHERE emp_no = ?
        ORDER BY to_date DESC
        LIMIT 1
      `, [emp.emp_no]);
      
      const result = {
        emp_no: emp.emp_no,
        first_name: emp.first_name,
        last_name: emp.last_name,
        full_name: `${emp.first_name} ${emp.last_name}`,
        salary: salaryRows[0]?.salary || 0,
        bonus: salaryRows[0]?.bonus || 0,
        currency: salaryRows[0]?.currency || 'EUR',
        from_date: salaryRows[0]?.from_date,
        to_date: salaryRows[0]?.to_date
      };
      
      console.log('✓ Najden:', result);
      
      return {
        content: [{
          type: "text",
          text: JSON.stringify(result, null, 2)
        }]
      };
    }

    case "mysql:executeSQL": {
      console.log('🔍 Izvajam SQL:', args.query);
      
      try {
        const [rows] = await connection.execute(args.query);
        console.log(`✓ Pridobljeno ${rows.length} vrstic`);
        
        return {
          content: [{
            type: "text",
            text: JSON.stringify(rows, null, 2)
          }]
        };
      } catch (error) {
        console.error('✗ SQL napaka:', error.message);
        return {
          content: [{
            type: "text",
            text: `SQL napaka: ${error.message}`
          }]
        };
      }
    }

    default:
      throw new Error(`Neznano orodje: ${name}`);
  }
}

async function startHTTPServer() {
  await initDatabase();
  
  const app = express();
  app.use(cors());
  app.use(express.json());
  
  // Endpoint za seznam orodij
  app.get('/tools', (req, res) => {
    res.json({ tools: TOOLS });
  });
  
  // Endpoint za klic orodij
  app.post('/call-tool', async (req, res) => {
    try {
      const { name, arguments: args } = req.body;
      console.log(`\n📞 Kličem orodje: ${name}`, args);
      const result = await handleToolCall(name, args);
      res.json(result);
    } catch (error) {
      console.error('✗ Napaka pri klicu orodja:', error);
      res.status(500).json({ 
        error: error.message,
        content: [{
          type: "text",
          text: `Napaka: ${error.message}`
        }]
      });
    }
  });
  
  const PORT = 3002;
  app.listen(PORT, () => {
    console.log(`✓ MCP HTTP Server teče na http://localhost:${PORT}\n`);
  });
}

startHTTPServer().catch((error) => {
  console.error("✗ Napaka:", error);
  process.exit(1);
});
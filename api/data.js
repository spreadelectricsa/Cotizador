export default async function handler(req, res) {
  const { filters } = req.body;
  const response = await fetch(
    `${process.env.API_URL}/spread_app.app_gestion_spread.report.costo_mano_de_obra.costo_mano_de_obra.get_labor_cost_no_quotation`,
    {
      method: 'POST',
      headers: {
        'Authorization': `token ${process.env.API_TOKEN}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ filters })
    }
  );
  const data = await response.json();
  res.status(response.status).json(data);
}

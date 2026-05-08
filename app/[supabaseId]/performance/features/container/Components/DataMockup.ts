const CLOSER_DETAILS = {
  "Ana Souza":     { team: "Time Comercial Sul",  email: "ana.souza@empresa.com",     joined: "Mar 2023", trend: [2,3,1,4,3,5,4,6,5,4,6,7,5,8], trendPct: 24, stats: { vendas: 18, receita: "R$ 1.248k", conversao: 38, reunioes: 47, noshow: 8, faltas: 4 } },
  "Carla Reis":    { team: "Time Comercial Sul",  email: "carla.reis@empresa.com",    joined: "Jul 2023", trend: [1,2,2,3,2,4,3,3,4,5,4,3,5,4], trendPct: 12, stats: { vendas: 14, receita: "R$ 942k",   conversao: 32, reunioes: 44, noshow: 9, faltas: 4 } },
  "Marcelo Otto":  { team: "Time Comercial SP",   email: "marcelo.otto@empresa.com",  joined: "Jan 2024", trend: [0,1,2,1,2,2,1,3,2,1,2,2,1,2], trendPct: 6,  stats: { vendas: 9,  receita: "R$ 612k",   conversao: 26, reunioes: 35, noshow: 11, faltas: 4 } },
  "Júlia Mendes":  { team: "Time Comercial SP",   email: "julia.mendes@empresa.com",  joined: "Set 2024", trend: [0,0,1,0,1,1,0,1,0,1,0,1,0,0], trendPct: -3, stats: { vendas: 4,  receita: "R$ 286k",   conversao: 18, reunioes: 22, noshow: 14, faltas: 3 } },
  "Renato Faria":  { team: "Time Comercial RJ",   email: "renato.faria@empresa.com",  joined: "Out 2024", trend: [0,0,0,1,0,0,0,1,0,0,0,0,0,0], trendPct: -8, stats: { vendas: 2,  receita: "R$ 124k",   conversao: 11, reunioes: 18, noshow: 22, faltas: 4 } },
};

const SDR_DETAILS = {
  "Bruno Lima":    { team: "Pré-vendas · Squad A", email: "bruno.lima@empresa.com",   joined: "Fev 2023", trend: [3,5,4,6,7,5,8,6,7,8,7,9,8,10], trendPct: 28, stats: { agendamentos: 62, realizadas: 57, show: 92, conexoes: 184, tentativas: 412, noshow: 8,  faltas: 5 } },
  "Diego Pinto":   { team: "Pré-vendas · Squad A", email: "diego.pinto@empresa.com",  joined: "Abr 2023", trend: [2,4,3,5,4,6,5,7,6,5,7,6,8,7],  trendPct: 18, stats: { agendamentos: 54, realizadas: 47, show: 88, conexoes: 162, tentativas: 388, noshow: 12, faltas: 7 } },
  "Helena Castro": { team: "Pré-vendas · Squad B", email: "helena.castro@empresa.com",joined: "Jun 2023", trend: [1,3,2,4,3,3,4,5,4,3,5,4,6,5],  trendPct: 9,  stats: { agendamentos: 41, realizadas: 34, show: 84, conexoes: 138, tentativas: 322, noshow: 16, faltas: 7 } },
  "Tiago Vieira":  { team: "Pré-vendas · Squad B", email: "tiago.vieira@empresa.com", joined: "Ago 2024", trend: [1,2,2,3,2,3,2,4,3,2,3,2,4,3],  trendPct: 4,  stats: { agendamentos: 33, realizadas: 26, show: 79, conexoes: 102, tentativas: 268, noshow: 21, faltas: 7 } },
  "Marina Alves":  { team: "Pré-vendas · Squad C", email: "marina.alves@empresa.com", joined: "Out 2024", trend: [1,1,2,1,2,1,2,2,1,2,1,2,2,1],  trendPct: -2, stats: { agendamentos: 24, realizadas: 17, show: 71, conexoes: 88,  tentativas: 244, noshow: 29, faltas: 7 } },
};
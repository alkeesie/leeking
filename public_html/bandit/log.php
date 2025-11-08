<?php
// /bandit/log.php — append JSON event rows to logs/bandit_log.csv
header('Content-Type: application/json');
header('Access-Control-Allow-Methods: POST, OPTIONS');
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') { exit; }

$raw = file_get_contents('php://input');
$data = json_decode($raw, true);
if (!$data || !isset($data['event']) || !isset($data['experiment_name'])) {
  http_response_code(400);
  echo json_encode(['ok'=>false,'error'=>'bad payload']); exit;
}

$ts = gmdate('c');
$row = [
  $ts,
  $data['event'] ?? '',                      // arm_impression | arm_click | algo_toggle | ad_added
  $data['experiment_name'] ?? '',
  $data['arm_id'] ?? '',
  $data['arm_label'] ?? '',
  $data['algorithm'] ?? '',
  $data['epsilon'] ?? '',
  $data['from'] ?? '',                        // for algo_toggle
  $data['to'] ?? '',                          // for algo_toggle
  $data['session_id'] ?? '',
  $_SERVER['HTTP_USER_AGENT'] ?? '',
  $_SERVER['HTTP_REFERER'] ?? ''
];

$dir = __DIR__ . '/logs';
if (!is_dir($dir)) { mkdir($dir, 0755, true); }
$fp = fopen($dir . '/bandit_log.csv', 'a');
if ($fp) {
  if (flock($fp, LOCK_EX)) { fputcsv($fp, $row); flock($fp, LOCK_UN); }
  fclose($fp);
  echo json_encode(['ok'=>true]);
} else {
  http_response_code(500);
  echo json_encode(['ok'=>false,'error'=>'cannot open log file']);
}

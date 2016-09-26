<?php

//  "paps --left-margin 1 top-margin 0 text.txt | ps2pdf -dEPSCrop - text.pdf"

if (isset($_GET['id_anagrafica']) && $_GET['id_anagrafica'] != '') {
	//
	var_dump(exec('curl -v http://pdf.sprea.it'));
	echo 'ok';
} 

exit();